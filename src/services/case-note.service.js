'use strict';

const pool = require('../config/database');


/**
 * Get all notes belonging to a Case.
 *
 * Notes are ordered newest first.
 *
 * @param {number} caseId
 * @returns {Promise<Array>}
 */
async function getNotesByCaseId(caseId) {

    const [notes] = await pool.execute(
        `
        SELECT
            cn.id,
            cn.case_id,
            cn.case_investigation_service_id,
            cn.created_by,
            cn.note_title,
            cn.note_content,
            cn.is_private,
            cn.created_at,
            cn.updated_at,

            u.username AS created_by_username,
            u.first_name AS created_by_first_name,
            u.middle_name AS created_by_middle_name,
            u.last_name AS created_by_last_name,

            it.name AS investigation_type_name,
            it.code AS investigation_type_code

        FROM case_notes cn

        INNER JOIN users u
            ON u.id = cn.created_by

        LEFT JOIN case_investigation_services cis
            ON cis.id = cn.case_investigation_service_id

        LEFT JOIN investigation_types it
            ON it.id = cis.investigation_type_id

        WHERE cn.case_id = ?

        ORDER BY
            cn.created_at DESC,
            cn.id DESC
        `,
        [caseId]
    );

    return notes;
}


/**
 * Get a single Case Note by ID.
 *
 * @param {number} noteId
 * @returns {Promise<Object|null>}
 */
async function getNoteById(noteId) {

    const [notes] = await pool.execute(
        `
        SELECT
            cn.id,
            cn.case_id,
            cn.case_investigation_service_id,
            cn.created_by,
            cn.note_title,
            cn.note_content,
            cn.is_private,
            cn.created_at,
            cn.updated_at,

            u.username AS created_by_username,
            u.first_name AS created_by_first_name,
            u.middle_name AS created_by_middle_name,
            u.last_name AS created_by_last_name,

            it.name AS investigation_type_name,
            it.code AS investigation_type_code

        FROM case_notes cn

        INNER JOIN users u
            ON u.id = cn.created_by

        LEFT JOIN case_investigation_services cis
            ON cis.id = cn.case_investigation_service_id

        LEFT JOIN investigation_types it
            ON it.id = cis.investigation_type_id

        WHERE cn.id = ?

        LIMIT 1
        `,
        [noteId]
    );

    if (notes.length === 0) {
        return null;
    }

    return notes[0];
}


/**
 * Confirm that a Case exists.
 *
 * @param {number} caseId
 * @returns {Promise<boolean>}
 */
async function caseExists(caseId) {

    const [cases] = await pool.execute(
        `
        SELECT
            id
        FROM cases
        WHERE id = ?
        LIMIT 1
        `,
        [caseId]
    );

    return cases.length > 0;
}


/**
 * Get active investigation services belonging
 * to a specific Case.
 *
 * These are used when creating or editing
 * a Case Note.
 *
 * @param {number} caseId
 * @returns {Promise<Array>}
 */
async function getInvestigationServicesByCaseId(caseId) {

    const [services] = await pool.execute(
        `
        SELECT
            cis.id,
            cis.case_id,
            cis.investigation_type_id,
            cis.service_status_id,
            cis.assigned_to,
            cis.display_order,

            it.name AS investigation_type_name,
            it.code AS investigation_type_code,

            ss.name AS service_status_name,
            ss.is_terminal AS service_status_is_terminal

        FROM case_investigation_services cis

        INNER JOIN investigation_types it
            ON it.id = cis.investigation_type_id

        INNER JOIN service_statuses ss
            ON ss.id = cis.service_status_id

        WHERE cis.case_id = ?

        ORDER BY
            cis.display_order ASC,
            cis.id ASC
        `,
        [caseId]
    );

    return services;
}


/**
 * Confirm that an investigation service belongs
 * to the specified Case.
 *
 * @param {number} caseId
 * @param {number} serviceId
 * @returns {Promise<boolean>}
 */
async function investigationServiceBelongsToCase(
    caseId,
    serviceId
) {

    const [services] = await pool.execute(
        `
        SELECT
            id
        FROM case_investigation_services
        WHERE id = ?
          AND case_id = ?
        LIMIT 1
        `,
        [
            serviceId,
            caseId
        ]
    );

    return services.length > 0;
}


/**
 * Create a Case Note.
 *
 * If an investigation service is supplied,
 * it must belong to the same Case.
 *
 * @param {number} caseId
 * @param {number} createdBy
 * @param {Object} data
 * @returns {Promise<number>}
 */
async function createNote(
    caseId,
    createdBy,
    data
) {

    const connection =
        await pool.getConnection();

    try {

        await connection.beginTransaction();


        /*
         * Confirm that the Case exists.
         */
        const [cases] =
            await connection.execute(
                `
                SELECT
                    id
                FROM cases
                WHERE id = ?
                LIMIT 1
                `,
                [caseId]
            );

        if (cases.length === 0) {
            throw new Error('Case not found.');
        }


        /*
         * If a service was supplied,
         * confirm that it belongs to
         * this Case.
         */
        if (data.caseInvestigationServiceId) {

            const [services] =
                await connection.execute(
                    `
                    SELECT
                        id
                    FROM case_investigation_services
                    WHERE id = ?
                      AND case_id = ?
                    LIMIT 1
                    `,
                    [
                        data.caseInvestigationServiceId,
                        caseId
                    ]
                );

            if (services.length === 0) {
                throw new Error(
                    'Investigation service does not belong to this Case.'
                );
            }
        }


        /*
         * Create the Case Note.
         */
        const [result] =
            await connection.execute(
                `
                INSERT INTO case_notes (
                    case_id,
                    case_investigation_service_id,
                    created_by,
                    note_title,
                    note_content,
                    is_private
                )
                VALUES (?, ?, ?, ?, ?, ?)
                `,
                [
                    caseId,
                    data.caseInvestigationServiceId || null,
                    createdBy,
                    data.noteTitle || null,
                    data.noteContent,
                    data.isPrivate ? 1 : 0
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
 * Update an existing Case Note.
 *
 * The Case and creator are preserved.
 *
 * If an investigation service is supplied,
 * it must belong to the Note's Case.
 *
 * @param {number} noteId
 * @param {Object} data
 * @returns {Promise<void>}
 */
async function updateNote(
    noteId,
    data
) {

    const connection =
        await pool.getConnection();

    try {

        await connection.beginTransaction();


        /*
         * Retrieve the existing Note.
         */
        const [notes] =
            await connection.execute(
                `
                SELECT
                    id,
                    case_id
                FROM case_notes
                WHERE id = ?
                LIMIT 1
                `,
                [noteId]
            );

        if (notes.length === 0) {
            throw new Error('Case note not found.');
        }


        const caseId =
            notes[0].case_id;


        /*
         * If a service was supplied,
         * confirm that it belongs to
         * the Note's Case.
         */
        if (data.caseInvestigationServiceId) {

            const [services] =
                await connection.execute(
                    `
                    SELECT
                        id
                    FROM case_investigation_services
                    WHERE id = ?
                      AND case_id = ?
                    LIMIT 1
                    `,
                    [
                        data.caseInvestigationServiceId,
                        caseId
                    ]
                );

            if (services.length === 0) {
                throw new Error(
                    'Investigation service does not belong to this Case.'
                );
            }
        }


        /*
         * Update the Note.
         *
         * case_id and created_by are deliberately
         * not changed.
         */
        await connection.execute(
            `
            UPDATE case_notes
            SET
                case_investigation_service_id = ?,
                note_title = ?,
                note_content = ?,
                is_private = ?
            WHERE id = ?
            `,
            [
                data.caseInvestigationServiceId || null,
                data.noteTitle || null,
                data.noteContent,
                data.isPrivate ? 1 : 0,
                noteId
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
    getNotesByCaseId,
    getNoteById,
    caseExists,
    getInvestigationServicesByCaseId,
    investigationServiceBelongsToCase,
    createNote,
    updateNote
};