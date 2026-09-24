#!/usr/bin/env node

"use strict";

require("dotenv").config();

const bcrypt = require("bcrypt");
const db = require("../src/config/database");

const SALT_ROUNDS = 12;

async function bootstrapAdmin() {
    let connection;

    try {
        console.log("========================================");
        console.log("NDUKA Bootstrap Administrator");
        console.log("========================================");

        const requiredEnv = [
            "BOOTSTRAP_ADMIN_USERNAME",
            "BOOTSTRAP_ADMIN_EMAIL",
            "BOOTSTRAP_ADMIN_PASSWORD",
            "BOOTSTRAP_ADMIN_PHONE",
            "BOOTSTRAP_ADMIN_FIRST_NAME",
            "BOOTSTRAP_ADMIN_LAST_NAME"
        ];

        const missing = requiredEnv.filter(
            key => !process.env[key] || process.env[key].trim() === ""
        );

        if (missing.length > 0) {
            throw new Error(
                `Missing required environment variable(s): ${missing.join(", ")}`
            );
        }

        connection = await db.getConnection();

        await connection.beginTransaction();

        //------------------------------------------------------------
        // Verify role
        //------------------------------------------------------------

        const [roleRows] = await connection.execute(
            `SELECT id
             FROM roles
             WHERE name = ?
             LIMIT 1`,
            ["super_admin"]
        );

        if (roleRows.length === 0) {
            throw new Error("Role 'super_admin' does not exist.");
        }

        const roleId = roleRows[0].id;

        //------------------------------------------------------------
        // Verify user status
        //------------------------------------------------------------

        const [statusRows] = await connection.execute(
            `SELECT id
             FROM user_statuses
             WHERE name = ?
             LIMIT 1`,
            ["active"]
        );

        if (statusRows.length === 0) {
            throw new Error("User status 'active' does not exist.");
        }

        const statusId = statusRows[0].id;

        //------------------------------------------------------------
        // Check whether administrator already exists
        //------------------------------------------------------------

        const username = process.env.BOOTSTRAP_ADMIN_USERNAME.trim();

        const [existingUsers] = await connection.execute(
            `SELECT id
             FROM users
             WHERE username = ?
             LIMIT 1`,
            [username]
        );

        if (existingUsers.length > 0) {
            await connection.rollback();

            console.log("");
            console.log("Bootstrap administrator already exists.");
            console.log("No changes were made.");

            return;
        }

        //------------------------------------------------------------
        // Hash password
        //------------------------------------------------------------

        const passwordHash = await bcrypt.hash(
            process.env.BOOTSTRAP_ADMIN_PASSWORD,
            SALT_ROUNDS
        );

        //------------------------------------------------------------
        // Insert administrator
        //------------------------------------------------------------

       const [userResult] = await connection.execute(
    `
    INSERT INTO users
    (
        username,
        first_name,
        last_name,
        phone,
        email,
        password_hash,
        status_id
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    [
        username,
        process.env.BOOTSTRAP_ADMIN_FIRST_NAME.trim(),
        process.env.BOOTSTRAP_ADMIN_LAST_NAME.trim(),
        process.env.BOOTSTRAP_ADMIN_PHONE.trim(),
        process.env.BOOTSTRAP_ADMIN_EMAIL.trim(),
        passwordHash,
        statusId
    ]
);

const userId = userResult.insertId;


await connection.execute(
    `
    INSERT INTO user_roles
    (
        user_id,
        role_id
    )
    VALUES (?, ?)
    `,
    [
        userId,
        roleId
    ]
);

        //------------------------------------------------------------
        // Commit
        //------------------------------------------------------------

        await connection.commit();

        console.log("");
        console.log("Bootstrap administrator created successfully.");
        console.log(`User ID : ${userId}`);
        console.log(`Username: ${username}`);
        console.log("Role    : super_admin");
        console.log("");

    } catch (error) {

        if (connection) {
            try {
                await connection.rollback();
            } catch (_) {}
        }

        console.error("");
        console.error("Bootstrap failed.");
        console.error(error.message);

        process.exitCode = 1;

    } finally {

        if (connection) {
            connection.release();
        }
    }
}

bootstrapAdmin();
