'use strict';

const crypto = require('crypto');
const bcrypt = require('bcrypt');

const pool =
    require('../config/database');


const MIN_PASSWORD_LENGTH = 8;


/**
 * Hash a Client account activation token.
 *
 * Only the hash is stored in the database.
 *
 * @param {string} token
 * @returns {string}
 */
function hashActivationToken(token) {

    return crypto
        .createHash('sha256')
        .update(token)
        .digest('hex');
}


/**
 * Validate a prospective Client password.
 *
 * @param {string} password
 * @returns {string}
 */
function validatePassword(password) {

    if (
        typeof password !== 'string' ||
        password.length < MIN_PASSWORD_LENGTH
    ) {

        throw new Error(
            'Password must be at least 8 characters long.'
        );

    }

    return password;
}


/**
 * Get the public state of a Client account activation token.
 *
 * This operation never changes the database.
 *
 * @param {string} token
 * @returns {Promise<Object>}
 */
async function getClientAccountActivation(
    token
) {

    const normalizedToken =
        typeof token === 'string'
            ? token.trim()
            : '';

    if (!normalizedToken) {

        throw new Error(
            'A Client account activation token is required.'
        );

    }

    const tokenHash =
        hashActivationToken(
            normalizedToken
        );

    const [rows] =
        await pool.execute(
            `
            SELECT
                ca.id,
                ca.activation_reference,
                ca.expires_at,
                ca.used_at,
                ca.revoked_at,

                cua.client_id,
                cua.user_id,

                u.username,
                u.first_name,
                u.last_name
            FROM client_account_activations ca

            INNER JOIN client_user_accounts cua
                ON cua.id =
                    ca.client_user_account_id

            INNER JOIN users u
                ON u.id =
                    cua.user_id

            WHERE ca.token_hash = ?
            LIMIT 1
            `,
            [tokenHash]
        );

    if (rows.length === 0) {

        return null;

    }

    const activation =
        rows[0];

    if (activation.used_at) {

        return {
            valid: false,
            reason: 'USED'
        };

    }

    if (activation.revoked_at) {

        return {
            valid: false,
            reason: 'REVOKED'
        };

    }

    const [expiryRows] =
        await pool.execute(
            `
            SELECT
                CASE
                    WHEN expires_at <= CURRENT_TIMESTAMP
                    THEN 1
                    ELSE 0
                END AS is_expired
            FROM client_account_activations
            WHERE id = ?
            LIMIT 1
            `,
            [activation.id]
        );

    if (
        expiryRows.length !== 1
    ) {

        throw new Error(
            'The Client account activation status could not be determined.'
        );

    }

    if (
        Number(
            expiryRows[0].is_expired
        ) === 1
    ) {

        return {
            valid: false,
            reason: 'EXPIRED'
        };

    }

    return {
        valid: true,

        activationReference:
            activation.activation_reference,

        clientId:
            Number(
                activation.client_id
            ),

        userId:
            Number(
                activation.user_id
            ),

        username:
            activation.username,

        firstName:
            activation.first_name,

        lastName:
            activation.last_name,

        expiresAt:
            activation.expires_at
    };
}


/**
 * Activate a Client account using a one-time activation token.
 *
 * The password update and token consumption occur inside
 * one database transaction.
 *
 * @param {string} token
 * @param {string} password
 * @returns {Promise<Object>}
 */
async function activateClientAccount(
    token,
    password
) {

    const normalizedToken =
        typeof token === 'string'
            ? token.trim()
            : '';

    if (!normalizedToken) {

        throw new Error(
            'A Client account activation token is required.'
        );

    }


    const normalizedPassword =
        validatePassword(password);


    const tokenHash =
        hashActivationToken(
            normalizedToken
        );


    const connection =
        await pool.getConnection();


    try {

        await connection.beginTransaction();


        /*
         * Lock the activation record and retrieve the
         * associated Client User Account and User.
         */
        const [activationRows] =
            await connection.execute(
                `
                SELECT
                    ca.id AS activation_id,
                    ca.activation_reference,
                    ca.client_user_account_id,
                    ca.expires_at,
                    ca.used_at,
                    ca.revoked_at,

                    cua.client_id,
                    cua.user_id,

                    u.username,
                    u.first_name,
                    u.last_name,
                    u.email,
                    u.phone
                FROM client_account_activations ca

                INNER JOIN client_user_accounts cua
                    ON cua.id =
                        ca.client_user_account_id

                INNER JOIN users u
                    ON u.id =
                        cua.user_id

                WHERE ca.token_hash = ?
                LIMIT 1

                FOR UPDATE
                `,
                [tokenHash]
            );


        if (activationRows.length === 0) {

            throw new Error(
                'This Client account activation link is invalid.'
            );

        }


        const activation =
            activationRows[0];


        /*
         * A consumed activation credential is permanently
         * invalid.
         */
        if (activation.used_at) {

            throw new Error(
                'This Client account activation link has already been used.'
            );

        }


        /*
         * A revoked credential cannot be used.
         */
        if (activation.revoked_at) {

            throw new Error(
                'This Client account activation link has been revoked.'
            );

        }


        /*
         * Use MySQL's clock because expires_at was generated
         * with MySQL CURRENT_TIMESTAMP.
         */
        const [expiryRows] =
            await connection.execute(
                `
                SELECT
                    CASE
                        WHEN expires_at <= CURRENT_TIMESTAMP
                        THEN 1
                        ELSE 0
                    END AS is_expired
                FROM client_account_activations
                WHERE id = ?
                LIMIT 1
                `,
                [activation.activation_id]
            );


        if (
            expiryRows.length !== 1
        ) {

            throw new Error(
                'The Client account activation status could not be determined.'
            );

        }


        if (
            Number(
                expiryRows[0].is_expired
            ) === 1
        ) {

            throw new Error(
                'This Client account activation link has expired.'
            );

        }


        /*
         * Hash the password chosen by the Client.
         */
        const passwordHash =
            await bcrypt.hash(
                normalizedPassword,
                12
            );


        /*
         * Set the Client's chosen password and invalidate
         * any previously established authenticated sessions.
         *
         * The account itself remains governed by the existing
         * users.status_id model.
         */
        const [userUpdate] =
            await connection.execute(
                `
                UPDATE users
                SET
                    password_hash = ?,
                    password_changed_at =
                        CURRENT_TIMESTAMP,
                    session_version =
                        session_version + 1
                WHERE id = ?
                `,
                [
                    passwordHash,
                    activation.user_id
                ]
            );


        if (
            userUpdate.affectedRows !== 1
        ) {

            throw new Error(
                'Client account password could not be established.'
            );

        }


        /*
         * Consume this activation credential permanently.
         */
        const [activationUpdate] =
            await connection.execute(
                `
                UPDATE client_account_activations
                SET
                    used_at = CURRENT_TIMESTAMP
                WHERE id = ?
                  AND used_at IS NULL
                  AND revoked_at IS NULL
                  AND expires_at > CURRENT_TIMESTAMP
                `,
                [activation.activation_id]
            );


        if (
            activationUpdate.affectedRows !== 1
        ) {

            throw new Error(
                'Client account activation could not be completed.'
            );

        }


        /*
         * Any other outstanding activation credentials for the
         * same Client User Account are revoked. This ensures that
         * only one activation credential remains usable.
         */
        await connection.execute(
            `
            UPDATE client_account_activations
            SET
                revoked_at = CURRENT_TIMESTAMP
            WHERE client_user_account_id = ?
              AND id <> ?
              AND used_at IS NULL
              AND revoked_at IS NULL
            `,
            [
                activation.client_user_account_id,
                activation.activation_id
            ]
        );


        await connection.commit();


        return {
            activated: true,

            activationReference:
                activation.activation_reference,

            clientId:
                Number(
                    activation.client_id
                ),

            clientUserAccountId:
                Number(
                    activation.client_user_account_id
                ),

            userId:
                Number(
                    activation.user_id
                ),

            username:
                activation.username,

            firstName:
                activation.first_name,

            lastName:
                activation.last_name,

            email:
                activation.email,

            phone:
                activation.phone
        };


    } catch (error) {

        await connection.rollback();

        throw error;

    } finally {

        connection.release();

    }
}


module.exports = {
    hashActivationToken,
    validatePassword,
    getClientAccountActivation,
    activateClientAccount
};
