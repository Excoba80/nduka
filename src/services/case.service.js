'use strict';

const pool = require('../config/database');


/**
 * Determine whether a user has a privileged Case role.
 *
 * @param {Array<string>} roles
 * @returns {boolean}
 */
function isPrivilegedCaseUser(roles = []) {

    return (
        roles.includes('super_admin') ||
        roles.includes('administrator')
    );
}


/**
 * Get all active case statuses.
 *
 * @returns {Promise<Array>}
 */
async function getAllActiveCaseStatuses() {

    const [statuses] = await pool.execute(
        `
        SELECT
            id,
            code,
            name,
            description,
            display_order,
            is_initial,
            is_terminal
        FROM case_statuses
        WHERE is_active = 1
        ORDER BY display_order ASC, id ASC
        `
    );

    return statuses;
}


/**
 * Get the initial Case status.
 *
 * The database flag is used rather than assuming
 * a particular status ID.
 *
 * @returns {Promise<Object|null>}
 */
async function getInitialCaseStatus() {

    const [statuses] = await pool.execute(
        `
        SELECT
            id,
            code,
            name,
            description,
            display_order,
            is_terminal
        FROM case_statuses
        WHERE is_active = 1
          AND is_initial = 1
        LIMIT 1
        `
    );

    if (statuses.length === 0) {
        return null;
    }

    return statuses[0];
}


/**
 * Get all active priority levels.
 *
 * @returns {Promise<Array>}
 */
async function getAllActivePriorityLevels() {

    const [priorities] = await pool.execute(
        `
        SELECT
            id,
            code,
            name,
            description,
            severity_rank,
            display_order,
            is_default
        FROM priority_levels
        WHERE is_active = 1
        ORDER BY display_order ASC, id ASC
        `
    );

    return priorities;
}


/**
 * Get the default priority level.
 *
 * The database flag is used rather than assuming
 * a particular priority ID.
 *
 * @returns {Promise<Object|null>}
 */
async function getDefaultPriorityLevel() {

    const [priorities] = await pool.execute(
        `
        SELECT
            id,
            code,
            name,
            description,
            severity_rank,
            display_order
        FROM priority_levels
        WHERE is_active = 1
          AND is_default = 1
        LIMIT 1
        `
    );

    if (priorities.length === 0) {
        return null;
    }

    return priorities[0];
}


/**
 * Get all clients available for Case creation.
 *
 * @returns {Promise<Array>}
 */
async function getClientsForCaseForm() {

    const [clients] = await pool.execute(
        `
        SELECT
            id,
            client_code,
            name
        FROM clients
        ORDER BY name ASC, id ASC
        `
    );

    return clients;
}


/**
 * Get all active investigators.
 *
 * Investigators are identified by their role rather
 * than by hard-coded user IDs.
 *
 * @returns {Promise<Array>}
 */
async function getInvestigators() {

    const [investigators] = await pool.execute(
        `
        SELECT DISTINCT
            u.id,
            u.username,
            u.first_name,
            u.middle_name,
            u.last_name,
            u.email
        FROM users u

        INNER JOIN user_roles ur
            ON ur.user_id = u.id

        INNER JOIN roles r
            ON r.id = ur.role_id

        WHERE r.name = 'investigator'
          AND u.status_id = (
              SELECT id
              FROM user_statuses
              WHERE name = 'active'
              LIMIT 1
          )

        ORDER BY
            u.first_name ASC,
            u.last_name ASC,
            u.id ASC
        `
    );

    return investigators;
}


/**
 * Generate a unique Case reference.
 *
 * Format:
 * CAS-XXXXXXXXXXXX
 *
 * @returns {string}
 */
function generateCaseReference() {

    const timestamp =
        Date.now()
            .toString(36)
            .toUpperCase();

    const random =
        Math.random()
            .toString(36)
            .substring(2, 7)
            .toUpperCase();

    return `CAS-${timestamp}${random}`.substring(0, 30);
}


/**
 * Get all Cases visible to the supplied user.
 *
 * Super administrators and administrators can see
 * all Cases.
 *
 * Investigators can only see Cases assigned to them.
 *
 * @param {Object} actor
 * @param {number} actor.id
 * @param {Array<string>} actor.roles
 * @returns {Promise<Array>}
 */
async function getAllCases(actor) {

    const privileged =
        isPrivilegedCaseUser(actor.roles || []);

    let sql = `
        SELECT
            c.id,
            c.case_reference,
            c.client_id,
            c.case_status_id,
            c.priority_level_id,
            c.created_by,
            c.assigned_to,
            c.case_title,
            c.request_summary,
            c.opened_at,
            c.closed_at,
            c.created_at,
            c.updated_at,

            cl.client_code,
            cl.name AS client_name,

            cs.code AS status_code,
            cs.name AS status_name,
            cs.is_terminal AS status_is_terminal,

            pl.code AS priority_code,
            pl.name AS priority_name,
            pl.severity_rank,

            creator.username AS created_by_username,
            creator.first_name AS created_by_first_name,
            creator.last_name AS created_by_last_name,

            assignee.username AS assigned_to_username,
            assignee.first_name AS assigned_to_first_name,
            assignee.last_name AS assigned_to_last_name,
            assignee.email AS assigned_to_email

        FROM cases c

        INNER JOIN clients cl
            ON cl.id = c.client_id

        INNER JOIN case_statuses cs
            ON cs.id = c.case_status_id

        INNER JOIN priority_levels pl
            ON pl.id = c.priority_level_id

        INNER JOIN users creator
            ON creator.id = c.created_by

        LEFT JOIN users assignee
            ON assignee.id = c.assigned_to
    `;

    const params = [];

    if (!privileged) {

        sql += `
            WHERE c.assigned_to = ?
        `;

        params.push(actor.id);
    }

    sql += `
        ORDER BY
            c.id DESC
    `;

    const [cases] =
        await pool.execute(sql, params);

    return cases;
}


/**
 * Get a single Case visible to the supplied user.
 *
 * This applies the same authorization rule as
 * getAllCases(), preventing an investigator from
 * accessing another investigator's Case by ID.
 *
 * @param {number} caseId
 * @param {Object} actor
 * @param {number} actor.id
 * @param {Array<string>} actor.roles
 * @returns {Promise<Object|null>}
 */
async function getCaseById(caseId, actor) {

    const privileged =
        isPrivilegedCaseUser(actor.roles || []);

    let sql = `
        SELECT
            c.id,
            c.case_reference,
            c.client_id,
            c.case_status_id,
            c.priority_level_id,
            c.created_by,
            c.assigned_to,
            c.case_title,
            c.request_summary,
            c.opened_at,
            c.closed_at,
            c.created_at,
            c.updated_at,

            cl.client_code,
            cl.name AS client_name,

            cs.code AS status_code,
            cs.name AS status_name,
            cs.description AS status_description,
            cs.is_terminal AS status_is_terminal,

            pl.code AS priority_code,
            pl.name AS priority_name,
            pl.description AS priority_description,
            pl.severity_rank,

            creator.username AS created_by_username,
            creator.first_name AS created_by_first_name,
            creator.middle_name AS created_by_middle_name,
            creator.last_name AS created_by_last_name,

            assignee.username AS assigned_to_username,
            assignee.first_name AS assigned_to_first_name,
            assignee.middle_name AS assigned_to_middle_name,
            assignee.last_name AS assigned_to_last_name,
            assignee.email AS assigned_to_email

        FROM cases c

        INNER JOIN clients cl
            ON cl.id = c.client_id

        INNER JOIN case_statuses cs
            ON cs.id = c.case_status_id

        INNER JOIN priority_levels pl
            ON pl.id = c.priority_level_id

        INNER JOIN users creator
            ON creator.id = c.created_by

        LEFT JOIN users assignee
            ON assignee.id = c.assigned_to

        WHERE c.id = ?
    `;

    const params = [caseId];

    if (!privileged) {

        sql += `
            AND c.assigned_to = ?
        `;

        params.push(actor.id);
    }

    sql += `
        LIMIT 1
    `;

    const [cases] =
        await pool.execute(sql, params);

    if (cases.length === 0) {
        return null;
    }

    return cases[0];
}


/**
 * Get a Case by ID without applying user visibility.
 *
 * This is intended for internal service operations where
 * authorization has already been established by the caller.
 *
 * @param {number} caseId
 * @returns {Promise<Object|null>}
 */
async function getCaseForUpdate(caseId) {

    const [cases] = await pool.execute(
        `
        SELECT
            id,
            case_reference,
            client_id,
            case_status_id,
            priority_level_id,
            created_by,
            assigned_to,
            case_title,
            request_summary,
            opened_at,
            closed_at,
            created_at,
            updated_at
        FROM cases
        WHERE id = ?
        LIMIT 1
        `,
        [caseId]
    );

    if (cases.length === 0) {
        return null;
    }

    return cases[0];
}


/**
 * Create a new Case.
 *
 * The initial status and default priority are resolved
 * from their database flags.
 *
 * Assignment is intentionally not performed during
 * Case creation.
 *
 * @param {Object} data
 * @param {number} data.clientId
 * @param {string} data.caseTitle
 * @param {string} data.requestSummary
 * @param {number|null} data.priorityLevelId
 * @param {number} data.createdBy
 * @returns {Promise<number>}
 */
async function createCase(data) {

    const connection =
        await pool.getConnection();

    try {

        await connection.beginTransaction();


        /*
         * Confirm that the selected Client exists.
         */
        const [clients] =
            await connection.execute(
                `
                SELECT
                    id
                FROM clients
                WHERE id = ?
                LIMIT 1
                `,
                [data.clientId]
            );

        if (clients.length === 0) {
            throw new Error(
                'Selected client does not exist.'
            );
        }


        /*
         * Resolve the initial Case status.
         */
        const [statuses] =
            await connection.execute(
                `
                SELECT
                    id,
                    code,
                    is_terminal
                FROM case_statuses
                WHERE is_active = 1
                  AND is_initial = 1
                LIMIT 1
                `
            );

        if (statuses.length === 0) {
            throw new Error(
                'No initial case status is configured.'
            );
        }

        const initialStatus =
            statuses[0];


        if (initialStatus.is_terminal) {
            throw new Error(
                'The configured initial case status cannot be terminal.'
            );
        }


        /*
         * Resolve the priority.
         *
         * If the caller supplied a priority ID,
         * validate it. Otherwise use the database
         * default priority.
         */
        let priorityLevelId =
            data.priorityLevelId || null;

        if (priorityLevelId) {

            const [priorities] =
                await connection.execute(
                    `
                    SELECT
                        id
                    FROM priority_levels
                    WHERE id = ?
                      AND is_active = 1
                    LIMIT 1
                    `,
                    [priorityLevelId]
                );

            if (priorities.length === 0) {
                throw new Error(
                    'Selected priority level does not exist.'
                );
            }

        } else {

            const [defaultPriorities] =
                await connection.execute(
                    `
                    SELECT
                        id
                    FROM priority_levels
                    WHERE is_active = 1
                      AND is_default = 1
                    LIMIT 1
                    `
                );

            if (defaultPriorities.length === 0) {
                throw new Error(
                    'No default priority level is configured.'
                );
            }

            priorityLevelId =
                defaultPriorities[0].id;
        }


        /*
         * Check Case title uniqueness only within
         * the application-level business rules.
         *
         * Case titles are intentionally not required
         * to be globally unique by the database schema.
         */
        const [existingReferences] =
            await connection.execute(
                `
                SELECT
                    id
                FROM cases
                WHERE case_title = ?
                  AND client_id = ?
                  AND case_status_id = ?
                LIMIT 1
                `,
                [
                    data.caseTitle,
                    data.clientId,
                    initialStatus.id
                ]
            );

        /*
         * Multiple cases with the same title for the
         * same client are not inherently invalid.
         *
         * Therefore this query is intentionally informational
         * and does not reject the creation.
         */
        void existingReferences;


        /*
         * Generate a unique Case reference.
         */
        let caseReference = null;
        let referenceCreated = false;

        for (let attempt = 0; attempt < 5; attempt++) {

            const candidate =
                generateCaseReference();

            const [existing] =
                await connection.execute(
                    `
                    SELECT
                        id
                    FROM cases
                    WHERE case_reference = ?
                    LIMIT 1
                    `,
                    [candidate]
                );

            if (existing.length === 0) {

                caseReference = candidate;
                referenceCreated = true;

                break;
            }
        }

        if (!referenceCreated) {
            throw new Error(
                'Unable to generate a unique case reference.'
            );
        }


        /*
         * Create the Case.
         *
         * assigned_to is deliberately NULL.
         */
        const [result] =
            await connection.execute(
                `
                INSERT INTO cases (
                    case_reference,
                    client_id,
                    case_status_id,
                    priority_level_id,
                    created_by,
                    assigned_to,
                    case_title,
                    request_summary
                )
                VALUES (?, ?, ?, ?, ?, NULL, ?, ?)
                `,
                [
                    caseReference,
                    data.clientId,
                    initialStatus.id,
                    priorityLevelId,
                    data.createdBy,
                    data.caseTitle,
                    data.requestSummary
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
 * Update basic Case information.
 *
 * Assignment, status and priority are intentionally
 * handled by separate service functions.
 *
 * @param {number} caseId
 * @param {Object} data
 * @returns {Promise<void>}
 */
async function updateCase(caseId, data) {

    const connection =
        await pool.getConnection();

    try {

        await connection.beginTransaction();


        /*
         * Confirm the Case exists.
         */
        const [cases] =
            await connection.execute(
                `
                SELECT
                    id,
                    client_id,
                    case_status_id
                FROM cases
                WHERE id = ?
                LIMIT 1
                `,
                [caseId]
            );

        if (cases.length === 0) {
            throw new Error(
                'Case does not exist.'
            );
        }


        /*
         * Confirm the selected Client exists.
         */
        const [clients] =
            await connection.execute(
                `
                SELECT
                    id
                FROM clients
                WHERE id = ?
                LIMIT 1
                `,
                [data.clientId]
            );

        if (clients.length === 0) {
            throw new Error(
                'Selected client does not exist.'
            );
        }


        /*
         * Update only the basic Case information.
         */
        await connection.execute(
            `
            UPDATE cases
            SET
                client_id = ?,
                case_title = ?,
                request_summary = ?
            WHERE id = ?
            `,
            [
                data.clientId,
                data.caseTitle,
                data.requestSummary,
                caseId
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
 * Assign a Case to an investigator.
 *
 * @param {number} caseId
 * @param {number} investigatorId
 * @returns {Promise<void>}
 */
async function assignCase(caseId, investigatorId) {

    const connection =
        await pool.getConnection();

    try {

        await connection.beginTransaction();


        /*
         * Confirm the Case exists.
         */
        const [cases] =
            await connection.execute(
                `
                SELECT
                    id,
                    case_status_id
                FROM cases
                WHERE id = ?
                LIMIT 1
                `,
                [caseId]
            );

        if (cases.length === 0) {
            throw new Error(
                'Case does not exist.'
            );
        }


        /*
         * Do not assign a terminal Case.
         */
        const [statuses] =
            await connection.execute(
                `
                SELECT
                    id,
                    code,
                    is_terminal
                FROM case_statuses
                WHERE id = ?
                LIMIT 1
                `,
                [cases[0].case_status_id]
            );

        if (
            statuses.length > 0 &&
            statuses[0].is_terminal
        ) {
            throw new Error(
                'A terminal case cannot be assigned.'
            );
        }


        /*
         * Confirm that the selected user currently
         * has the investigator role and is active.
         */
        const [investigators] =
            await connection.execute(
                `
                SELECT DISTINCT
                    u.id
                FROM users u

                INNER JOIN user_roles ur
                    ON ur.user_id = u.id

                INNER JOIN roles r
                    ON r.id = ur.role_id

                INNER JOIN user_statuses us
                    ON us.id = u.status_id

                WHERE u.id = ?
                  AND r.name = 'investigator'
                  AND us.name = 'active'
                LIMIT 1
                `,
                [investigatorId]
            );

        if (investigators.length === 0) {
            throw new Error(
                'Selected user is not an active investigator.'
            );
        }


        await connection.execute(
            `
            UPDATE cases
            SET
                assigned_to = ?
            WHERE id = ?
            `,
            [
                investigatorId,
                caseId
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
 * Change the status of a Case.
 *
 * Terminal Cases cannot be moved to another status.
 *
 * The transition policy is intentionally centralized here.
 *
 * @param {number} caseId
 * @param {number} statusId
 * @returns {Promise<void>}
 */
async function changeCaseStatus(caseId, statusId) {

    const connection =
        await pool.getConnection();

    try {

        await connection.beginTransaction();


        /*
         * Lock the Case while checking and changing
         * its lifecycle state.
         */
        const [cases] =
            await connection.execute(
                `
                SELECT
                    id,
                    case_status_id
                FROM cases
                WHERE id = ?
                FOR UPDATE
                `,
                [caseId]
            );

        if (cases.length === 0) {
            throw new Error(
                'Case does not exist.'
            );
        }


        /*
         * Retrieve the current status.
         */
        const [currentStatuses] =
            await connection.execute(
                `
                SELECT
                    id,
                    code,
                    is_terminal
                FROM case_statuses
                WHERE id = ?
                LIMIT 1
                `,
                [cases[0].case_status_id]
            );

        if (currentStatuses.length === 0) {
            throw new Error(
                'Current case status does not exist.'
            );
        }

        const currentStatus =
            currentStatuses[0];


        /*
         * Retrieve the requested status.
         */
        const [targetStatuses] =
            await connection.execute(
                `
                SELECT
                    id,
                    code,
                    is_active,
                    is_terminal
                FROM case_statuses
                WHERE id = ?
                LIMIT 1
                `,
                [statusId]
            );

        if (
            targetStatuses.length === 0 ||
            !targetStatuses[0].is_active
        ) {
            throw new Error(
                'Selected case status does not exist or is inactive.'
            );
        }

        const targetStatus =
            targetStatuses[0];


        /*
         * No-op status changes are rejected.
         */
        if (
            Number(currentStatus.id) ===
            Number(targetStatus.id)
        ) {
            throw new Error(
                'Case is already in the selected status.'
            );
        }


        /*
         * Terminal Cases cannot transition further.
         */
        if (currentStatus.is_terminal) {
            throw new Error(
                'A terminal case cannot change status.'
            );
        }


        /*
         * For now, allow transitions between active
         * non-terminal states and into terminal states.
         *
         * The actual workflow rules remain centralized
         * here so they can be tightened without changing
         * the controller or views.
         */
        let closedAt = null;

        if (targetStatus.is_terminal) {
            closedAt = new Date();
        }


        await connection.execute(
            `
            UPDATE cases
            SET
                case_status_id = ?,
                closed_at = ?
            WHERE id = ?
            `,
            [
                targetStatus.id,
                closedAt,
                caseId
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
 * Change the priority of a Case.
 *
 * @param {number} caseId
 * @param {number} priorityLevelId
 * @returns {Promise<void>}
 */
async function changeCasePriority(
    caseId,
    priorityLevelId
) {

    const connection =
        await pool.getConnection();

    try {

        await connection.beginTransaction();


        /*
         * Confirm the Case exists.
         */
        const [cases] =
            await connection.execute(
                `
                SELECT
                    id,
                    case_status_id
                FROM cases
                WHERE id = ?
                LIMIT 1
                `,
                [caseId]
            );

        if (cases.length === 0) {
            throw new Error(
                'Case does not exist.'
            );
        }


        /*
         * Do not change the priority of a terminal Case.
         */
        const [statuses] =
            await connection.execute(
                `
                SELECT
                    is_terminal
                FROM case_statuses
                WHERE id = ?
                LIMIT 1
                `,
                [cases[0].case_status_id]
            );

        if (
            statuses.length > 0 &&
            statuses[0].is_terminal
        ) {
            throw new Error(
                'A terminal case cannot change priority.'
            );
        }


        /*
         * Confirm the requested priority is active.
         */
        const [priorities] =
            await connection.execute(
                `
                SELECT
                    id
                FROM priority_levels
                WHERE id = ?
                  AND is_active = 1
                LIMIT 1
                `,
                [priorityLevelId]
            );

        if (priorities.length === 0) {
            throw new Error(
                'Selected priority level does not exist or is inactive.'
            );
        }


        await connection.execute(
            `
            UPDATE cases
            SET
                priority_level_id = ?
            WHERE id = ?
            `,
            [
                priorityLevelId,
                caseId
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
 * Get all active Investigation Types.
 *
 * @returns {Promise<Array>}
 */
async function getAllActiveInvestigationTypes() {

    const [types] = await pool.execute(
        `
        SELECT
            id,
            code,
            name,
            description,
            display_order
        FROM investigation_types
        WHERE is_active = 1
        ORDER BY display_order ASC, id ASC
        `
    );

    return types;
}


/**
 * Get all active Service Statuses.
 *
 * @returns {Promise<Array>}
 */
async function getAllActiveServiceStatuses() {

    const [statuses] = await pool.execute(
        `
        SELECT
            id,
            code,
            name,
            description,
            display_order,
            is_default,
            is_terminal
        FROM service_statuses
        WHERE is_active = 1
        ORDER BY display_order ASC, id ASC
        `
    );

    return statuses;
}


/**
 * Get the default Service Status.
 *
 * @returns {Promise<Object|null>}
 */
async function getDefaultServiceStatus() {

    const [statuses] = await pool.execute(
        `
        SELECT
            id,
            code,
            name,
            description,
            is_terminal
        FROM service_statuses
        WHERE is_active = 1
          AND is_default = 1
        LIMIT 1
        `
    );

    if (statuses.length === 0) {
        return null;
    }

    return statuses[0];
}


/**
 * Get all Investigation Services belonging to a Case.
 *
 * @param {number} caseId
 * @returns {Promise<Array>}
 */
async function getCaseInvestigationServices(caseId) {

    const [services] = await pool.execute(
        `
        SELECT
            cis.id,
            cis.case_id,
            cis.investigation_type_id,
            cis.service_status_id,
            cis.created_by,
            cis.assigned_to,
            cis.completed_by,
            cis.display_order,
            cis.service_notes,
            cis.started_at,
            cis.completed_at,
            cis.created_at,
            cis.updated_at,

            it.code AS investigation_type_code,
            it.name AS investigation_type_name,
            it.description AS investigation_type_description,

            ss.code AS service_status_code,
            ss.name AS service_status_name,
            ss.description AS service_status_description,
            ss.is_terminal AS service_status_is_terminal,

            creator.username AS created_by_username,
            creator.first_name AS created_by_first_name,
            creator.middle_name AS created_by_middle_name,
            creator.last_name AS created_by_last_name,

            assignee.username AS assigned_to_username,
            assignee.first_name AS assigned_to_first_name,
            assignee.middle_name AS assigned_to_middle_name,
            assignee.last_name AS assigned_to_last_name,
            assignee.email AS assigned_to_email,

            completer.username AS completed_by_username,
            completer.first_name AS completed_by_first_name,
            completer.last_name AS completed_by_last_name

        FROM case_investigation_services cis

        INNER JOIN investigation_types it
            ON it.id = cis.investigation_type_id

        INNER JOIN service_statuses ss
            ON ss.id = cis.service_status_id

        INNER JOIN users creator
            ON creator.id = cis.created_by

        LEFT JOIN users assignee
            ON assignee.id = cis.assigned_to

        LEFT JOIN users completer
            ON completer.id = cis.completed_by

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
 * Add an Investigation Service to a Case.
 *
 * New services always begin with the configured
 * default Service Status.
 *
 * @param {number} caseId
 * @param {number} investigationTypeId
 * @param {number} createdBy
 * @returns {Promise<number>}
 */
async function addInvestigationService(
    caseId,
    investigationTypeId,
    createdBy
) {

    const connection =
        await pool.getConnection();

    try {

        await connection.beginTransaction();


        /*
         * Confirm Case exists and is not terminal.
         */
        const [cases] =
            await connection.execute(
                `
                SELECT
                    c.id,
                    cs.is_terminal
                FROM cases c

                INNER JOIN case_statuses cs
                    ON cs.id = c.case_status_id

                WHERE c.id = ?
                LIMIT 1
                `,
                [caseId]
            );

        if (cases.length === 0) {
            throw new Error(
                'Case does not exist.'
            );
        }

        if (cases[0].is_terminal) {
            throw new Error(
                'A terminal case cannot have investigation services added.'
            );
        }


        /*
         * Confirm Investigation Type is active.
         */
        const [types] =
            await connection.execute(
                `
                SELECT
                    id,
                    name
                FROM investigation_types
                WHERE id = ?
                  AND is_active = 1
                LIMIT 1
                `,
                [investigationTypeId]
            );

        if (types.length === 0) {
            throw new Error(
                'Selected investigation type does not exist or is inactive.'
            );
        }


        /*
         * Prevent duplicate service explicitly.
         *
         * The database UNIQUE constraint remains the
         * final protection.
         */
        const [existing] =
            await connection.execute(
                `
                SELECT
                    id
                FROM case_investigation_services
                WHERE case_id = ?
                  AND investigation_type_id = ?
                LIMIT 1
                `,
                [
                    caseId,
                    investigationTypeId
                ]
            );

        if (existing.length > 0) {
            throw new Error(
                'This investigation service has already been added to the Case.'
            );
        }


        /*
         * Resolve default Service Status.
         */
        const [statuses] =
            await connection.execute(
                `
                SELECT
                    id,
                    is_terminal
                FROM service_statuses
                WHERE is_active = 1
                  AND is_default = 1
                LIMIT 1
                `
            );

        if (statuses.length === 0) {
            throw new Error(
                'No default service status is configured.'
            );
        }

        if (statuses[0].is_terminal) {
            throw new Error(
                'The configured default service status cannot be terminal.'
            );
        }


        /*
         * Determine the next display order.
         */
        const [orders] =
            await connection.execute(
                `
                SELECT
                    COALESCE(MAX(display_order), 0) + 1 AS next_order
                FROM case_investigation_services
                WHERE case_id = ?
                `,
                [caseId]
            );

        const displayOrder =
            orders[0].next_order;


        /*
         * Create the service.
         */
        const [result] =
            await connection.execute(
                `
                INSERT INTO case_investigation_services (
                    case_id,
                    investigation_type_id,
                    service_status_id,
                    created_by,
                    display_order
                )
                VALUES (?, ?, ?, ?, ?)
                `,
                [
                    caseId,
                    investigationTypeId,
                    statuses[0].id,
                    createdBy,
                    displayOrder
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
 * Assign an Investigation Service to an investigator.
 *
 * @param {number} serviceId
 * @param {number} investigatorId
 * @returns {Promise<void>}
 */
async function assignInvestigationService(
    serviceId,
    investigatorId
) {

    const connection =
        await pool.getConnection();

    try {

        await connection.beginTransaction();


        /*
         * Retrieve the Service.
         */
        const [services] =
            await connection.execute(
                `
                SELECT
                    id,
                    service_status_id
                FROM case_investigation_services
                WHERE id = ?
                LIMIT 1
                `,
                [serviceId]
            );

        if (services.length === 0) {
            throw new Error(
                'Investigation service does not exist.'
            );
        }


        /*
         * Terminal services cannot be assigned.
         */
        const [statuses] =
            await connection.execute(
                `
                SELECT
                    is_terminal
                FROM service_statuses
                WHERE id = ?
                LIMIT 1
                `,
                [services[0].service_status_id]
            );

        if (
            statuses.length > 0 &&
            statuses[0].is_terminal
        ) {
            throw new Error(
                'A terminal investigation service cannot be assigned.'
            );
        }


        /*
         * Confirm active investigator.
         */
        const [investigators] =
            await connection.execute(
                `
                SELECT DISTINCT
                    u.id
                FROM users u

                INNER JOIN user_roles ur
                    ON ur.user_id = u.id

                INNER JOIN roles r
                    ON r.id = ur.role_id

                INNER JOIN user_statuses us
                    ON us.id = u.status_id

                WHERE u.id = ?
                  AND r.name = 'investigator'
                  AND us.name = 'active'
                LIMIT 1
                `,
                [investigatorId]
            );

        if (investigators.length === 0) {
            throw new Error(
                'Selected user is not an active investigator.'
            );
        }


        await connection.execute(
            `
            UPDATE case_investigation_services
            SET
                assigned_to = ?
            WHERE id = ?
            `,
            [
                investigatorId,
                serviceId
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
 * Change the status of an Investigation Service.
 *
 * Terminal services cannot transition further.
 *
 * @param {number} serviceId
 * @param {number} statusId
 * @param {number} actorUserId
 * @returns {Promise<void>}
 */




/**
 * Change the status of an Investigation Service.
 *
 * Rules:
 * - Terminal services cannot transition further.
 * - A service must have an assigned investigator before
 *   it can transition to IN_PROGRESS.
 * - The first transition to IN_PROGRESS sets started_at.
 * - A terminal transition sets completed_at and completed_by.
 * - Historical timestamps are preserved.
 *
 * @param {number} serviceId
 * @param {number} statusId
 * @param {number} actorUserId
 * @returns {Promise<void>}
 */
async function changeInvestigationServiceStatus(
    serviceId,
    statusId,
    actorUserId
) {

    const connection =
        await pool.getConnection();

    try {

        await connection.beginTransaction();


        /*
         * Lock the Service.
         */
        const [services] =
            await connection.execute(
                `
                SELECT
                    id,
                    service_status_id,
                    assigned_to,
                    started_at,
                    completed_at
                FROM case_investigation_services
                WHERE id = ?
                FOR UPDATE
                `,
                [serviceId]
            );

        if (services.length === 0) {
            throw new Error(
                'Investigation service does not exist.'
            );
        }

        const service =
            services[0];


        /*
         * Retrieve current status.
         */
        const [currentStatuses] =
            await connection.execute(
                `
                SELECT
                    id,
                    code,
                    is_terminal
                FROM service_statuses
                WHERE id = ?
                LIMIT 1
                `,
                [service.service_status_id]
            );

        if (currentStatuses.length === 0) {
            throw new Error(
                'Current service status does not exist.'
            );
        }

        const currentStatus =
            currentStatuses[0];


        /*
         * Retrieve requested status.
         */
        const [targetStatuses] =
            await connection.execute(
                `
                SELECT
                    id,
                    code,
                    is_active,
                    is_terminal
                FROM service_statuses
                WHERE id = ?
                LIMIT 1
                `,
                [statusId]
            );

        if (
            targetStatuses.length === 0 ||
            !targetStatuses[0].is_active
        ) {
            throw new Error(
                'Selected service status does not exist or is inactive.'
            );
        }

        const targetStatus =
            targetStatuses[0];


        /*
         * Reject no-op.
         */
        if (
            Number(currentStatus.id) ===
            Number(targetStatus.id)
        ) {
            throw new Error(
                'Investigation service is already in the selected status.'
            );
        }


        /*
         * Terminal services cannot transition.
         */
        if (currentStatus.is_terminal) {
            throw new Error(
                'A terminal investigation service cannot change status.'
            );
        }


        /*
         * An Investigation Service must have an
         * assigned investigator before it can start.
         */
        if (
            targetStatus.code === 'IN_PROGRESS' &&
            !service.assigned_to
        ) {
            throw new Error(
                'An investigation service must be assigned to an investigator before it can be started.'
            );
        }


        /*
         * Preserve historical timestamps.
         */
        let startedAt =
            service.started_at;

        let completedAt =
            service.completed_at;

        let completedBy =
            null;


        /*
         * First transition into In Progress.
         */
        if (
            targetStatus.code === 'IN_PROGRESS' &&
            !startedAt
        ) {
            startedAt = new Date();
        }


        /*
         * Terminal transition.
         */
        if (targetStatus.is_terminal) {

            completedAt =
                new Date();

            completedBy =
                actorUserId;
        }


        /*
         * Preserve existing completed_by unless
         * this transition is terminal.
         */
        if (!targetStatus.is_terminal) {

            const [existingCompletion] =
                await connection.execute(
                    `
                    SELECT
                        completed_by
                    FROM case_investigation_services
                    WHERE id = ?
                    LIMIT 1
                    `,
                    [serviceId]
                );

            if (existingCompletion.length > 0) {
                completedBy =
                    existingCompletion[0].completed_by;
            }
        }


        await connection.execute(
            `
            UPDATE case_investigation_services
            SET
                service_status_id = ?,
                started_at = ?,
                completed_at = ?,
                completed_by = ?
            WHERE id = ?
            `,
            [
                targetStatus.id,
                startedAt,
                completedAt,
                completedBy,
                serviceId
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
    getAllActiveCaseStatuses,
    getInitialCaseStatus,
    getAllActivePriorityLevels,
    getDefaultPriorityLevel,
    getClientsForCaseForm,
    getInvestigators,
    getAllCases,
    getCaseById,
    getCaseForUpdate,
    createCase,
    updateCase,
    assignCase,
    changeCaseStatus,
    changeCasePriority,
    getAllActiveInvestigationTypes,
    getAllActiveServiceStatuses,
    getDefaultServiceStatus,
    getCaseInvestigationServices,
    addInvestigationService,
    assignInvestigationService,
    changeInvestigationServiceStatus
};