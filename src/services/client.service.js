'use strict';

const pool = require('../config/database');


/**
 * Get all clients.
 *
 * Returns the client together with its client type
 * and number of contacts.
 *
 * @returns {Promise<Array>}
 */
async function getAllClients() {

    const [clients] = await pool.execute(
        `
        SELECT
            c.id,
            c.client_code,
            c.name,
            c.registration_number,
            c.tax_number,
            c.website,
            c.address_line_1,
            c.address_line_2,
            c.city,
            c.state,
            c.country,
            c.postal_code,
            c.remarks,
            ct.name AS client_type,
            ct.display_name AS client_type_display,
            COUNT(cc.id) AS contact_count,
            c.created_at,
            c.updated_at
        FROM clients c

        INNER JOIN client_types ct
            ON ct.id = c.client_type_id

        LEFT JOIN client_contacts cc
            ON cc.client_id = c.id

        GROUP BY
            c.id,
            c.client_code,
            c.name,
            c.registration_number,
            c.tax_number,
            c.website,
            c.address_line_1,
            c.address_line_2,
            c.city,
            c.state,
            c.country,
            c.postal_code,
            c.remarks,
            ct.name,
            ct.display_name,
            c.created_at,
            c.updated_at

        ORDER BY c.id DESC
        `
    );

    return clients;
}


/**
 * Get a single client by ID.
 *
 * @param {number} clientId
 * @returns {Promise<Object|null>}
 */
async function getClientById(clientId) {

    const [clients] = await pool.execute(
        `
        SELECT
            c.id,
            c.client_type_id,
            c.client_code,
            c.name,
            c.registration_number,
            c.tax_number,
            c.website,
            c.address_line_1,
            c.address_line_2,
            c.city,
            c.state,
            c.country,
            c.postal_code,
            c.remarks,
            ct.name AS client_type,
            ct.display_name AS client_type_display,
            c.created_at,
            c.updated_at
        FROM clients c

        INNER JOIN client_types ct
            ON ct.id = c.client_type_id

        WHERE c.id = ?

        LIMIT 1
        `,
        [clientId]
    );

    if (clients.length === 0) {
        return null;
    }

    const client = clients[0];

    /*
     * Retrieve the client's contacts separately.
     */
    const [contacts] = await pool.execute(
        `
        SELECT
            id,
            title,
            first_name,
            middle_name,
            last_name,
            position,
            phone,
            email,
            is_primary,
            is_active,
            remarks,
            created_at,
            updated_at
        FROM client_contacts
        WHERE client_id = ?
        ORDER BY
            is_primary DESC,
            id ASC
        `,
        [clientId]
    );

    return {
        ...client,
        contacts
    };
}


/**
 * Get all client types.
 *
 * @returns {Promise<Array>}
 */
async function getAllClientTypes() {

    const [clientTypes] = await pool.execute(
        `
        SELECT
            id,
            name,
            display_name,
            description,
            display_order
        FROM client_types
        WHERE is_system = 1
        ORDER BY display_order ASC, id ASC
        `
    );

    return clientTypes;
}


/**
 * Generate a unique client code.
 *
 * Format:
 * CLT-XXXXXXXXXXXX
 *
 * The generated value remains well within
 * the clients.client_code VARCHAR(20) limit.
 *
 * @returns {string}
 */
function generateClientCode() {

    const timestamp = Date.now().toString(36).toUpperCase();

    const random = Math.random()
        .toString(36)
        .substring(2, 7)
        .toUpperCase();

    return `CLT-${timestamp}${random}`.substring(0, 20);
}


/**
 * Create a new client.
 *
 * @param {Object} data
 * @returns {Promise<number>}
 */
async function createClient(data) {

    const connection = await pool.getConnection();

    try {

        await connection.beginTransaction();


        /*
         * Confirm that the selected client type exists.
         */
        const [clientTypes] = await connection.execute(
            `
            SELECT
                id
            FROM client_types
            WHERE id = ?
            LIMIT 1
            `,
            [data.clientTypeId]
        );

        if (clientTypes.length === 0) {
            throw new Error('Selected client type does not exist.');
        }


        /*
         * Check client-name uniqueness.
         */
        const [existingName] = await connection.execute(
            `
            SELECT
                id
            FROM clients
            WHERE name = ?
            LIMIT 1
            `,
            [data.name]
        );

        if (existingName.length > 0) {
            throw new Error('Client name already exists.');
        }


        /*
         * Generate a client code.
         *
         * Retry if an extremely unlikely collision occurs.
         */
        let clientCode;
        let attempts = 0;

        do {

            clientCode = generateClientCode();
            attempts++;

            const [existingCode] = await connection.execute(
                `
                SELECT
                    id
                FROM clients
                WHERE client_code = ?
                LIMIT 1
                `,
                [clientCode]
            );

            if (existingCode.length === 0) {
                break;
            }

            if (attempts >= 5) {
                throw new Error(
                    'Unable to generate a unique client code.'
                );
            }

        } while (true);


        /*
         * Create the client.
         */
        const [result] = await connection.execute(
            `
            INSERT INTO clients (
                client_type_id,
                client_code,
                name,
                registration_number,
                tax_number,
                website,
                address_line_1,
                address_line_2,
                city,
                state,
                country,
                postal_code,
                remarks
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            [
                data.clientTypeId,
                clientCode,
                data.name,
                data.registrationNumber || null,
                data.taxNumber || null,
                data.website || null,
                data.addressLine1 || null,
                data.addressLine2 || null,
                data.city || null,
                data.state || null,
                data.country || null,
                data.postalCode || null,
                data.remarks || null
            ]
        );


        await connection.commit();

        return result.insertId;

    } catch (error) {

        await connection.rollback();

        throw error;

    } finally {

        connection.release();

    }
}


/**
 * Update an existing client.
 *
 * @param {number} clientId
 * @param {Object} data
 * @returns {Promise<void>}
 */
async function updateClient(clientId, data) {

    const connection = await pool.getConnection();

    try {

        await connection.beginTransaction();


        /*
         * Confirm that the client exists.
         */
        const [clients] = await connection.execute(
            `
            SELECT
                id
            FROM clients
            WHERE id = ?
            LIMIT 1
            `,
            [clientId]
        );

        if (clients.length === 0) {
            throw new Error('Client not found.');
        }


        /*
         * Confirm that the selected client type exists.
         */
        const [clientTypes] = await connection.execute(
            `
            SELECT
                id
            FROM client_types
            WHERE id = ?
            LIMIT 1
            `,
            [data.clientTypeId]
        );

        if (clientTypes.length === 0) {
            throw new Error('Selected client type does not exist.');
        }


        /*
         * Check client-name uniqueness.
         *
         * Exclude the current client.
         */
        const [existingName] = await connection.execute(
            `
            SELECT
                id
            FROM clients
            WHERE name = ?
              AND id <> ?
            LIMIT 1
            `,
            [
                data.name,
                clientId
            ]
        );

        if (existingName.length > 0) {
            throw new Error('Client name already exists.');
        }


        /*
         * Update the client.
         *
         * client_code is deliberately not changed.
         * It is the permanent identifier assigned
         * when the client was created.
         */
        await connection.execute(
            `
            UPDATE clients
            SET
                client_type_id = ?,
                name = ?,
                registration_number = ?,
                tax_number = ?,
                website = ?,
                address_line_1 = ?,
                address_line_2 = ?,
                city = ?,
                state = ?,
                country = ?,
                postal_code = ?,
                remarks = ?
            WHERE id = ?
            `,
            [
                data.clientTypeId,
                data.name,
                data.registrationNumber || null,
                data.taxNumber || null,
                data.website || null,
                data.addressLine1 || null,
                data.addressLine2 || null,
                data.city || null,
                data.state || null,
                data.country || null,
                data.postalCode || null,
                data.remarks || null,
                clientId
            ]
        );


        await connection.commit();

    } catch (error) {

        await connection.rollback();

        throw error;

    } finally {

        connection.release();

    }
}


module.exports = {
    getAllClients,
    getClientById,
    getAllClientTypes,
    createClient,
    updateClient
};