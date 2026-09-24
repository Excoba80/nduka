'use strict';

const pool = require('../config/database');


/**
 * Get all contacts belonging to a client.
 *
 * @param {number} clientId
 * @returns {Promise<Array>}
 */
async function getContactsByClientId(clientId) {

    const [contacts] = await pool.execute(
        `
        SELECT
            id,
            client_id,
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
            is_active DESC,
            last_name ASC,
            first_name ASC,
            id ASC
        `,
        [clientId]
    );

    return contacts;
}


/**
 * Get a single contact by ID.
 *
 * @param {number} contactId
 * @returns {Promise<Object|null>}
 */
async function getContactById(contactId) {

    const [contacts] = await pool.execute(
        `
        SELECT
            id,
            client_id,
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
        WHERE id = ?
        LIMIT 1
        `,
        [contactId]
    );

    if (contacts.length === 0) {
        return null;
    }

    return contacts[0];
}


/**
 * Confirm that a client exists.
 *
 * @param {number} clientId
 * @returns {Promise<boolean>}
 */
async function clientExists(clientId) {

    const [clients] = await pool.execute(
        `
        SELECT
            id
        FROM clients
        WHERE id = ?
        LIMIT 1
        `,
        [clientId]
    );

    return clients.length > 0;
}


/**
 * Create a client contact.
 *
 * If the new contact is marked as primary,
 * the existing primary contact is cleared
 * within the same transaction.
 *
 * @param {number} clientId
 * @param {Object} data
 * @returns {Promise<number>}
 */
async function createContact(clientId, data) {

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
         * If this contact is primary,
         * remove primary status from the
         * client's existing primary contact.
         */
        if (data.isPrimary) {

            await connection.execute(
                `
                UPDATE client_contacts
                SET
                    is_primary = 0
                WHERE client_id = ?
                  AND is_primary = 1
                `,
                [clientId]
            );
        }


        /*
         * Create the contact.
         */
        const [result] = await connection.execute(
            `
            INSERT INTO client_contacts (
                client_id,
                title,
                first_name,
                middle_name,
                last_name,
                position,
                phone,
                email,
                is_primary,
                is_active,
                remarks
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            [
                clientId,
                data.title || null,
                data.firstName,
                data.middleName || null,
                data.lastName,
                data.position || null,
                data.phone,
                data.email || null,
                data.isPrimary ? 1 : 0,
                data.isActive === false ? 0 : 1,
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
 * Update an existing client contact.
 *
 * If the contact is being made primary,
 * the existing primary contact for the same
 * client is cleared within the same transaction.
 *
 * @param {number} contactId
 * @param {Object} data
 * @returns {Promise<void>}
 */
async function updateContact(contactId, data) {

    const connection = await pool.getConnection();

    try {

        await connection.beginTransaction();


        /*
         * Retrieve the existing contact.
         */
        const [contacts] = await connection.execute(
            `
            SELECT
                id,
                client_id
            FROM client_contacts
            WHERE id = ?
            LIMIT 1
            `,
            [contactId]
        );

        if (contacts.length === 0) {
            throw new Error('Client contact not found.');
        }

        const clientId = contacts[0].client_id;


        /*
         * If this contact is primary,
         * remove primary status from
         * every other contact belonging
         * to the same client.
         */
        if (data.isPrimary) {

            await connection.execute(
                `
                UPDATE client_contacts
                SET
                    is_primary = 0
                WHERE client_id = ?
                  AND id <> ?
                  AND is_primary = 1
                `,
                [
                    clientId,
                    contactId
                ]
            );
        }


        /*
         * Update the contact.
         */
        await connection.execute(
            `
            UPDATE client_contacts
            SET
                title = ?,
                first_name = ?,
                middle_name = ?,
                last_name = ?,
                position = ?,
                phone = ?,
                email = ?,
                is_primary = ?,
                is_active = ?,
                remarks = ?
            WHERE id = ?
            `,
            [
                data.title || null,
                data.firstName,
                data.middleName || null,
                data.lastName,
                data.position || null,
                data.phone,
                data.email || null,
                data.isPrimary ? 1 : 0,
                data.isActive === false ? 0 : 1,
                data.remarks || null,
                contactId
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


/**
 * Set a contact as the client's primary contact.
 *
 * @param {number} clientId
 * @param {number} contactId
 * @returns {Promise<void>}
 */
async function setPrimaryContact(clientId, contactId) {

    const connection = await pool.getConnection();

    try {

        await connection.beginTransaction();


        /*
         * Confirm that the contact belongs
         * to the specified client.
         */
        const [contacts] = await connection.execute(
            `
            SELECT
                id
            FROM client_contacts
            WHERE id = ?
              AND client_id = ?
            LIMIT 1
            `,
            [
                contactId,
                clientId
            ]
        );

        if (contacts.length === 0) {
            throw new Error(
                'Client contact does not belong to this client.'
            );
        }


        /*
         * Clear the current primary contact.
         */
        await connection.execute(
            `
            UPDATE client_contacts
            SET
                is_primary = 0
            WHERE client_id = ?
            `,
            [clientId]
        );


        /*
         * Set the selected contact as primary.
         */
        await connection.execute(
            `
            UPDATE client_contacts
            SET
                is_primary = 1
            WHERE id = ?
              AND client_id = ?
            `,
            [
                contactId,
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


/**
 * Set a contact's active status.
 *
 * @param {number} contactId
 * @param {boolean} isActive
 * @returns {Promise<void>}
 */
async function setContactActiveStatus(
    contactId,
    isActive
) {

    const [result] = await pool.execute(
        `
        UPDATE client_contacts
        SET
            is_active = ?
        WHERE id = ?
        `,
        [
            isActive ? 1 : 0,
            contactId
        ]
    );

    if (result.affectedRows === 0) {
        throw new Error('Client contact not found.');
    }
}


module.exports = {
    getContactsByClientId,
    getContactById,
    clientExists,
    createContact,
    updateContact,
    setPrimaryContact,
    setContactActiveStatus
};
