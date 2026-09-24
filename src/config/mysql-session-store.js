'use strict';

const session = require('express-session');
const mysql = require('mysql2/promise');

const Store = session.Store;

class MySQLSessionStore extends Store {
    constructor(options = {}) {
        super();

        this.pool = mysql.createPool({
            host: options.host,
            port: Number(options.port),
            user: options.user,
            password: options.password,
            database: options.database,
            waitForConnections: true,
            connectionLimit: options.connectionLimit || 10,
            maxIdle: options.maxIdle || 10,
            idleTimeout: options.idleTimeout || 60000,
            queueLimit: 0
        });

        this.cleanupInterval = setInterval(() => {
            this.clearExpired().catch((error) => {
                console.error('Session cleanup error:', error.message);
            });
        }, options.cleanupInterval || 15 * 60 * 1000);

        if (this.cleanupInterval.unref) {
            this.cleanupInterval.unref();
        }
    }

    get(sid, callback) {
        this.pool.execute(
            'SELECT data, expires FROM sessions WHERE session_id = ? LIMIT 1',
            [sid]
        )
        .then(([rows]) => {
            if (!rows.length) {
                return callback(null, null);
            }

            const row = rows[0];

            if (Number(row.expires) <= Date.now()) {
                return this.destroy(sid, (error) => {
                    if (error) {
                        return callback(error);
                    }

                    callback(null, null);
                });
            }

            let sessionData;

            try {
                sessionData = row.data === null ? null : JSON.parse(row.data);
            } catch (error) {
                return callback(error);
            }

            callback(null, sessionData);
        })
        .catch(callback);
    }

    set(sid, sessionData, callback) {
        let data;

        try {
            data = JSON.stringify(sessionData);
        } catch (error) {
            return callback(error);
        }

        const expires =
            sessionData &&
            sessionData.cookie &&
            sessionData.cookie.expires
                ? new Date(sessionData.cookie.expires).getTime()
                : Date.now() + 24 * 60 * 60 * 1000;

        this.pool.execute(
            `
            INSERT INTO sessions (session_id, expires, data)
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE
                expires = VALUES(expires),
                data = VALUES(data)
            `,
            [sid, expires, data]
        )
        .then(() => callback(null))
        .catch(callback);
    }

    destroy(sid, callback) {
        this.pool.execute(
            'DELETE FROM sessions WHERE session_id = ?',
            [sid]
        )
        .then(() => callback(null))
        .catch(callback);
    }

    touch(sid, sessionData, callback) {
        const expires =
            sessionData &&
            sessionData.cookie &&
            sessionData.cookie.expires
                ? new Date(sessionData.cookie.expires).getTime()
                : Date.now() + 24 * 60 * 60 * 1000;

        this.pool.execute(
            'UPDATE sessions SET expires = ? WHERE session_id = ?',
            [expires, sid]
        )
        .then(() => callback(null))
        .catch(callback);
    }

    clear(callback) {
        this.pool.execute('DELETE FROM sessions')
            .then(() => callback(null))
            .catch(callback);
    }

    length(callback) {
        this.pool.execute(
            'SELECT COUNT(*) AS count FROM sessions'
        )
            .then(([rows]) => callback(null, Number(rows[0].count)))
            .catch(callback);
    }

    all(callback) {
        this.pool.execute(
            'SELECT data FROM sessions WHERE expires > ?',
            [Date.now()]
        )
            .then(([rows]) => {
                const sessions = [];

                for (const row of rows) {
                    try {
                        sessions.push(JSON.parse(row.data));
                    } catch (error) {
                        return callback(error);
                    }
                }

                callback(null, sessions);
            })
            .catch(callback);
    }

    clearExpired() {
        return this.pool.execute(
            'DELETE FROM sessions WHERE expires <= ?',
            [Date.now()]
        );
    }

    async close() {
        clearInterval(this.cleanupInterval);
        await this.pool.end();
    }
}

module.exports = MySQLSessionStore;
