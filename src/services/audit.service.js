'use strict';

const pool = require('../config/database');

/**
 * Record an audit event.
 *
 * @param {Object} data
 * @param {number|null} data.actorUserId
 * @param {string} data.action
 * @param {number|null} data.targetUserId
 * @param {string|null} data.description
 * @param {string|null} data.ipAddress
 * @param {string|null} data.userAgent
 * @returns {Promise<number>}
 */
async function log({
    actorUserId = null,
    action,
    targetUserId = null,
    description = null,
    ipAddress = null,
    userAgent = null
}) {

    if (!action) {
        throw new Error('Audit action is required.');
    }

    const [result] = await pool.execute(
        `
        INSERT INTO audit_logs (
            actor_user_id,
            action,
            target_user_id,
            description,
            ip_address,
            user_agent
        )
        VALUES (?, ?, ?, ?, ?, ?)
        `,
        [
            actorUserId,
            action,
            targetUserId,
            description,
            ipAddress,
            userAgent
        ]
    );

    return result.insertId;
}


/**
 * Retrieve audit logs.
 *
 * @param {Object} options
 * @param {number} options.page
 * @param {number} options.limit
 * @param {string|null} options.action
 * @returns {Promise<Object>}
 */


/**
 * Retrieve audit logs.
 *
 * @param {Object} options
 * @param {number} options.page
 * @param {number} options.limit
 * @param {string|null} options.action
 * @returns {Promise<Object>}
 */
async function getLogs({
    page = 1,
    limit = 25,
    action = null
} = {}) {

    page = Number(page);
    limit = Number(limit);

    if (!Number.isInteger(page) || page < 1) {
        page = 1;
    }

    if (!Number.isInteger(limit) || limit < 1) {
        limit = 25;
    }

    /*
     * Prevent excessively large requests.
     */
    if (limit > 100) {
        limit = 100;
    }

    const offset = (page - 1) * limit;

    /*
     * Build optional filters.
     */
    const conditions = [];
    const params = [];

    if (action) {
        conditions.push('a.action = ?');
        params.push(action);
    }

    const whereClause = conditions.length > 0
        ? `WHERE ${conditions.join(' AND ')}`
        : '';

    /*
     * Count total records.
     */
    const [countRows] = await pool.execute(
        `
        SELECT COUNT(*) AS total
        FROM audit_logs a
        ${whereClause}
        `,
        params
    );

    const total = Number(countRows[0].total);

    /*
     * Retrieve the actual audit records.
     */
    const [rows] = await pool.execute(
        `
        SELECT
            a.id,
            a.actor_user_id,
            a.action,
            a.target_user_id,
            a.description,
            a.ip_address,
            a.user_agent,
            a.created_at,

            CONCAT(
                actor.first_name,
                ' ',
                actor.last_name
            ) AS actor_name,

            actor.username AS actor_username,

            CONCAT(
                target.first_name,
                ' ',
                target.last_name
            ) AS target_name,

            target.username AS target_username

        FROM audit_logs a

        LEFT JOIN users actor
            ON actor.id = a.actor_user_id

        LEFT JOIN users target
            ON target.id = a.target_user_id

        ${whereClause}

        ORDER BY a.id DESC

        LIMIT ${limit}
        OFFSET ${offset}
        `,
        params
    );

    const totalPages = Math.ceil(total / limit);

    return {
        rows,
        pagination: {
            page,
            limit,
            total,
            totalPages
        }
    };
}


/**
 * Retrieve a single audit log by ID.
 *
 * Includes actor and target information.
 *
 * @param {number} auditId
 * @returns {Promise<Object|null>}
 */
async function getLogById(auditId) {

    auditId = Number(auditId);

    if (!Number.isInteger(auditId) || auditId <= 0) {
        return null;
    }

    const [rows] = await pool.execute(
        `
        SELECT
            a.id,
            a.actor_user_id,
            a.action,
            a.target_user_id,
            a.description,
            a.ip_address,
            a.user_agent,
            a.created_at,

            CONCAT(
                actor.first_name,
                ' ',
                actor.last_name
            ) AS actor_name,

            actor.username AS actor_username,

            actor.email AS actor_email,

            CONCAT(
                target.first_name,
                ' ',
                target.last_name
            ) AS target_name,

            target.username AS target_username,

            target.email AS target_email

        FROM audit_logs a

        LEFT JOIN users actor
            ON actor.id = a.actor_user_id

        LEFT JOIN users target
            ON target.id = a.target_user_id

        WHERE a.id = ?

        LIMIT 1
        `,
        [auditId]
    );

    if (rows.length === 0) {
        return null;
    }

    return rows[0];
}


/**
 * Retrieve the distinct audit actions.
 *
 * Used to populate the audit-log filter.
 *
 * @returns {Promise<string[]>}
 */
async function getActions() {

    const [rows] = await pool.execute(
        `
        SELECT DISTINCT
            action
        FROM audit_logs
        ORDER BY action
        `
    );

    return rows.map(row => row.action);
}


/**
 * Retrieve audit statistics.
 *
 * Classification:
 *
 * Successful:
 *     Any audit action that is not explicitly
 *     marked as FAILED or BLOCKED.
 *
 * Failed:
 *     Actions ending with _FAILED.
 *
 * Blocked:
 *     Actions ending with _BLOCKED.
 *
 * @param {string|null} action
 * @returns {Promise<Object>}
 */
async function getStats(action = null) {

    const conditions = [];
    const params = [];

    if (action) {
        conditions.push('action = ?');
        params.push(action);
    }

    const whereClause = conditions.length > 0
        ? `WHERE ${conditions.join(' AND ')}`
        : '';

    const [rows] = await pool.execute(
        `
        SELECT

            COUNT(*) AS total_events,

            /*
             * Failed events.
             */
            SUM(
                CASE
                    WHEN action LIKE '%_FAILED'
                    THEN 1
                    ELSE 0
                END
            ) AS failed_events,

            /*
             * Blocked events.
             */
            SUM(
                CASE
                    WHEN action LIKE '%_BLOCKED'
                    THEN 1
                    ELSE 0
                END
            ) AS blocked_events,

            /*
             * Successful events.
             */
            SUM(
                CASE
                    WHEN action NOT LIKE '%_FAILED'
                     AND action NOT LIKE '%_BLOCKED'
                    THEN 1
                    ELSE 0
                END
            ) AS successful_events

        FROM audit_logs

        ${whereClause}
        `,
        params
    );

    return {
        totalEvents: Number(rows[0].total_events) || 0,
        successfulEvents: Number(rows[0].successful_events) || 0,
        failedEvents: Number(rows[0].failed_events) || 0,
        blockedEvents: Number(rows[0].blocked_events) || 0
    };
}



module.exports = {
    log,
    getLogs,
    getLogById,
    getActions,
    getStats
};
