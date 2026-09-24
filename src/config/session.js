'use strict';

const session = require('express-session');
const MySQLSessionStore = require('./mysql-session-store');

const ONE_DAY = 1000 * 60 * 60 * 24;

if (!process.env.SESSION_SECRET) {
    throw new Error('SESSION_SECRET is not configured.');
}

const sessionStore = new MySQLSessionStore({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

module.exports = session({
    name: 'nduka.sid',
    secret: process.env.SESSION_SECRET,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
        maxAge: ONE_DAY,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax'
    }
});
