'use strict'

const pool =
    require('../config/database');


/**
 * Determine whether a user has a privileged
 * Investigation Workspace role.
 *
 * @param {Array<string>} roles
 * @returns {boolean}
 */
function isPrivilegedInvestigationUser(roles = []) {

    return (
        roles.includes('super_admin') ||
        roles.includes('administrator')
    );
}


/**
 * Get all active Investigation Types.
 *
 * Used by the Investigation Workspace and
 * Case Investigation Service workflow.
 *
 * @returns {Promise<Array>}
 */
async function getAllActiveInvestigationTypes() {

    const [types] =
        await pool.execute(
            `
            SELECT
                id,
                code,
                name,
                description,
                display_order
            FROM investigation_types
            WHERE is_active = 1
            ORDER BY
                display_order ASC,
                id ASC
            `
        );

    return types;
}


/**
 * Get all Investigation Types.
 *
 * Includes both active and inactive types.
 *
 * Used by Investigation Type Management.
 *
 * @returns {Promise<Array>}
 */
async function getAllInvestigationTypes() {
    const [types] = await pool.execute(`
        SELECT
            id,
            code,
            name,
            description,
            service_price,
            display_order,
            is_active,
            created_at,
            updated_at
        FROM investigation_types
        ORDER BY display_order ASC, id ASC
    `);

    return types;
}


/**
 * Get a single Investigation Type by ID.
 *
 * @param {number} investigationTypeId
 * @returns {Promise<Object|null>}
 */
async function getInvestigationTypeById(investigationTypeId) {
    const [types] = await pool.execute(`
        SELECT
            id,
            code,
            name,
            description,
            service_price,
            display_order,
            is_active,
            created_at,
            updated_at
        FROM investigation_types
        WHERE id = ?
        LIMIT 1
    `, [investigationTypeId]);

    if (types.length === 0) return null;

    return types[0];
}

/**
 * Create an Investigation Type.
 *
 * @param {Object} data
 * @returns {Promise<number>}
 */

async function createInvestigationType(data) {
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const code =
            String(data.code || '')
                .trim()
                .toUpperCase();

        const name =
            String(data.name || '')
                .trim();

        const description =
            data.description
                ? String(data.description).trim()
                : null;

        const servicePrice =
            Number(data.servicePrice);

        const displayOrder =
            Number.isInteger(Number(data.displayOrder)) &&
            Number(data.displayOrder) > 0
                ? Number(data.displayOrder)
                : 1;

        if (!code) {
            throw new Error(
                'Investigation Type code is required.'
            );
        }

        if (!name) {
            throw new Error(
                'Investigation Type name is required.'
            );
        }

        if (
            !Number.isFinite(servicePrice) ||
            servicePrice <= 0
        ) {
            throw new Error(
                'Investigation Type service price must be greater than zero.'
            );
        }

        const [existingCode] =
            await connection.execute(`
                SELECT id
                FROM investigation_types
                WHERE code = ?
                LIMIT 1
            `, [code]);

        if (existingCode.length > 0) {
            throw new Error(
                'An Investigation Type with this code already exists.'
            );
        }

        const [existingName] =
            await connection.execute(`
                SELECT id
                FROM investigation_types
                WHERE name = ?
                LIMIT 1
            `, [name]);

        if (existingName.length > 0) {
            throw new Error(
                'An Investigation Type with this name already exists.'
            );
        }

        const [result] =
            await connection.execute(`
                INSERT INTO investigation_types (
                    code,
                    name,
                    description,
                    service_price,
                    display_order,
                    is_active
                )
                VALUES (?, ?, ?, ?, ?, 1)
            `, [
                code,
                name,
                description,
                servicePrice,
                displayOrder
            ]);

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
 * Update an Investigation Type.
 *
 * The record's ID and lifecycle state are preserved.
 *
 * @param {number} investigationTypeId
 * @param {Object} data
 * @returns {Promise<void>}
 */

async function updateInvestigationType(investigationTypeId, data) {
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const [types] =
            await connection.execute(`
                SELECT id
                FROM investigation_types
                WHERE id = ?
                LIMIT 1
            `, [investigationTypeId]);

        if (types.length === 0) {
            throw new Error(
                'Investigation Type not found.'
            );
        }

        const code =
            String(data.code || '')
                .trim()
                .toUpperCase();

        const name =
            String(data.name || '')
                .trim();

        const description =
            data.description
                ? String(data.description).trim()
                : null;

        const servicePrice =
            Number(data.servicePrice);

        const displayOrder =
            Number.isInteger(Number(data.displayOrder)) &&
            Number(data.displayOrder) > 0
                ? Number(data.displayOrder)
                : 1;

        if (!code) {
            throw new Error(
                'Investigation Type code is required.'
            );
        }

        if (!name) {
            throw new Error(
                'Investigation Type name is required.'
            );
        }

        if (
            !Number.isFinite(servicePrice) ||
            servicePrice < 0
        ) {
            throw new Error(
                'Investigation Type service price must be a valid non-negative number.'
            );
        }

        const [existingCode] =
            await connection.execute(`
                SELECT id
                FROM investigation_types
                WHERE code = ?
                  AND id <> ?
                LIMIT 1
            `, [
                code,
                investigationTypeId
            ]);

        if (existingCode.length > 0) {
            throw new Error(
                'An Investigation Type with this code already exists.'
            );
        }

        const [existingName] =
            await connection.execute(`
                SELECT id
                FROM investigation_types
                WHERE name = ?
                  AND id <> ?
                LIMIT 1
            `, [
                name,
                investigationTypeId
            ]);

        if (existingName.length > 0) {
            throw new Error(
                'An Investigation Type with this name already exists.'
            );
        }

        await connection.execute(`
            UPDATE investigation_types
            SET
                code = ?,
                name = ?,
                description = ?,
                service_price = ?,
                display_order = ?
            WHERE id = ?
        `, [
            code,
            name,
            description,
            servicePrice,
            displayOrder,
            investigationTypeId
        ]);

        await connection.commit();

    } catch (error) {

        await connection.rollback();

        throw error;

    } finally {

        connection.release();

    }
}

/**
 * Toggle the active state of an Investigation Type.
 *
 * @param {number} investigationTypeId
 * @returns {Promise<boolean>}
 */


async function toggleInvestigationType(
    investigationTypeId
) {

    const connection =
        await pool.getConnection();

    try {

        await connection.beginTransaction();


        /*
         * Lock the Investigation Type while
         * changing its state.
         */
        const [types] =
            await connection.execute(
                `
                SELECT
                    id,
                    is_active
                FROM investigation_types
                WHERE id = ?
                FOR UPDATE
                `,
                [investigationTypeId]
            );

        if (types.length === 0) {
            throw new Error(
                'Investigation Type not found.'
            );
        }


        const newActiveState =
            types[0].is_active ? 0 : 1;


        /*
         * An Investigation Type may only be activated
         * when it has at least one active required field.
         *
         * This preserves the business rule that every
         * active Investigation Type must have at least
         * one active required field.
         */
        if (newActiveState === 1) {

            const [requiredFields] =
                await connection.execute(
                    `
                    SELECT
                        COUNT(*) AS total
                    FROM investigation_type_fields
                    WHERE investigation_type_id = ?
                      AND is_active = 1
                      AND is_required = 1
                    `,
                    [investigationTypeId]
                );

            if (
                Number(requiredFields[0].total) < 1
            ) {
                throw new Error(
                    'This Investigation Type cannot be activated because it has no active required field.'
                );
            }
        }


        await connection.execute(
            `
            UPDATE investigation_types
            SET
                is_active = ?
            WHERE id = ?
            `,
            [
                newActiveState,
                investigationTypeId
            ]
        );


        await connection.commit();

        return Boolean(newActiveState);

    } catch (error) {

        await connection.rollback();

        throw error;

    } finally {

        connection.release();

    }
}


async function deleteInvestigationType(
    investigationTypeId
) {

    const connection =
        await pool.getConnection();

    try {

        await connection.beginTransaction();


        /*
         * Lock the Investigation Type.
         */
        const [types] =
            await connection.execute(
                `
                SELECT
                    id
                FROM investigation_types
                WHERE id = ?
                FOR UPDATE
                `,
                [investigationTypeId]
            );

        if (types.length === 0) {
            throw new Error(
                'Investigation Type not found.'
            );
        }


        /*
         * Check whether the Investigation Type
         * has ever been used by a Case.
         */
        const [usage] =
            await connection.execute(
                `
                SELECT
                    id
                FROM case_investigation_services
                WHERE investigation_type_id = ?
                LIMIT 1
                `,
                [investigationTypeId]
            );

        if (usage.length > 0) {
            throw new Error(
                'This Investigation Type cannot be deleted because it has been used by an Investigation Service. Deactivate it instead.'
            );
        }


        /*
         * Delete the unused Investigation Type.
         */
        await connection.execute(
            `
            DELETE FROM investigation_types
            WHERE id = ?
            `,
            [investigationTypeId]
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
 * Get Investigation Services visible to the
 * supplied user.
 *
 * Privileged users can see all Investigation Services.
 *
 * Investigators can only see services belonging to
 * Cases assigned to them.
 *
 * The Investigation Workspace displays the investigator
 * assigned to the overall Case.
 *
 * Service-level assignment remains available within
 * Case Management and the Investigation Service workflow.
 *
 * @param {Object} actor
 * @param {number} actor.id
 * @param {Array<string>} actor.roles
 * @returns {Promise<Array>}
 */
async function getInvestigationServices(actor) {

    const privileged =
        isPrivilegedInvestigationUser(
            actor.roles || []
        );

    let sql = `
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

            c.case_reference,
            c.case_title,
            c.case_status_id,
            c.priority_level_id,
            c.assigned_to AS case_assigned_to,

            cl.client_code,
            cl.name AS client_name,

            cs.code AS case_status_code,
            cs.name AS case_status_name,
            cs.is_terminal AS case_status_is_terminal,

            pl.code AS priority_code,
            pl.name AS priority_name,
            pl.severity_rank,

            it.code AS investigation_type_code,
            it.name AS investigation_type_name,
            it.description AS investigation_type_description,

            ss.code AS service_status_code,
            ss.name AS service_status_name,
            ss.description AS service_status_description,
            ss.is_terminal AS service_status_is_terminal,

            case_assignee.username AS case_assignee_username,
            case_assignee.first_name AS case_assignee_first_name,
            case_assignee.middle_name AS case_assignee_middle_name,
            case_assignee.last_name AS case_assignee_last_name,
            case_assignee.email AS case_assignee_email,

            assignee.username AS assigned_to_username,
            assignee.first_name AS assigned_to_first_name,
            assignee.middle_name AS assigned_to_middle_name,
            assignee.last_name AS assigned_to_last_name,
            assignee.email AS assigned_to_email,

            creator.username AS created_by_username,
            creator.first_name AS created_by_first_name,
            creator.middle_name AS created_by_middle_name,
            creator.last_name AS created_by_last_name,

            completer.username AS completed_by_username,
            completer.first_name AS completed_by_first_name,
            completer.middle_name AS completed_by_middle_name,
            completer.last_name AS completed_by_last_name

        FROM case_investigation_services cis

        INNER JOIN cases c
            ON c.id = cis.case_id

        INNER JOIN clients cl
            ON cl.id = c.client_id

        INNER JOIN case_statuses cs
            ON cs.id = c.case_status_id

        INNER JOIN priority_levels pl
            ON pl.id = c.priority_level_id

        INNER JOIN investigation_types it
            ON it.id = cis.investigation_type_id

        INNER JOIN service_statuses ss
            ON ss.id = cis.service_status_id

        INNER JOIN users creator
            ON creator.id = cis.created_by

        LEFT JOIN users case_assignee
            ON case_assignee.id = c.assigned_to

        LEFT JOIN users assignee
            ON assignee.id = cis.assigned_to

        LEFT JOIN users completer
            ON completer.id = cis.completed_by
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
            CASE
                WHEN ss.is_terminal = 0 THEN 0
                ELSE 1
            END ASC,
            cis.updated_at DESC,
            cis.id DESC
    `;

    const [services] =
        await pool.execute(
            sql,
            params
        );

    return services;
}



/**
 * Investigation Type Field Management
 */

/**
 * Get all fields configured for an Investigation Type.
 *
 * @param {number} investigationTypeId
 * @param {object} options
 * @param {boolean} options.includeInactive
 * @returns {Promise<Array>}
 */
async function getInvestigationTypeFields(
    investigationTypeId,
    { includeInactive = true } = {}
) {

    const [rows] = await pool.query(
        `
        SELECT
            id,
            investigation_type_id,
            field_key,
            field_label,
            field_type,
            placeholder,
            help_text,
            options,
            is_required,
            display_order,
            is_active,
            created_at,
            updated_at
        FROM investigation_type_fields
        WHERE investigation_type_id = ?
          ${includeInactive ? '' : 'AND is_active = 1'}
        ORDER BY display_order ASC, id ASC
        `,
        [investigationTypeId]
    );

    return rows;
}

/**
 * Get one Investigation Type Field and its parent Investigation Type.
 *
 * @param {number} investigationTypeId
 * @param {number} fieldId
 * @returns {Promise<object|null>}
 */
async function getInvestigationTypeFieldById(
    investigationTypeId,
    fieldId
) {

    const [rows] = await pool.query(
        `
        SELECT
            itf.id,
            itf.investigation_type_id,
            itf.field_key,
            itf.field_label,
            itf.field_type,
            itf.placeholder,
            itf.help_text,
            itf.options,
            itf.is_required,
            itf.display_order,
            itf.is_active,
            itf.created_at,
            itf.updated_at,
            it.code AS investigation_type_code,
            it.name AS investigation_type_name,
            it.is_active AS investigation_type_active
        FROM investigation_type_fields itf
        INNER JOIN investigation_types it
            ON it.id = itf.investigation_type_id
        WHERE itf.investigation_type_id = ?
          AND itf.id = ?
        LIMIT 1
        `,
        [investigationTypeId, fieldId]
    );

    return rows[0] || null;
}

/**
 * Validate and normalize field options.
 *
 * SELECT, RADIO and CHECKBOX fields require a non-empty JSON array
 * of non-empty string options.
 *
 * Other field types must not require options.
 *
 * @param {string} fieldType
 * @param {*} options
 * @returns {Array|null}
 */
function normalizeInvestigationTypeFieldOptions(fieldType, options) {
    const optionTypes = ['SELECT', 'RADIO', 'CHECKBOX'];

    if (!optionTypes.includes(fieldType)) {
        return null;
    }

    let normalized = options;

    if (typeof normalized === 'string') {
        try {
            normalized = JSON.parse(normalized);
        } catch (error) {
            throw new Error(
                'Options must contain valid JSON for this field type.'
            );
        }
    }

    if (!Array.isArray(normalized)) {
        throw new Error(
            'Options must contain a valid JSON array for SELECT, RADIO, or CHECKBOX fields.'
        );
    }

    normalized = normalized
        .map((option) => String(option).trim())
        .filter(Boolean);

    if (normalized.length < 2) {
        throw new Error(
            'At least two valid options are required for SELECT, RADIO, or CHECKBOX fields.'
        );
    }

    if (new Set(normalized.map((option) => option.toLowerCase())).size !== normalized.length) {
        throw new Error('Field options must not contain duplicates.');
    }

    return normalized;
}

/**
 * Validate common Investigation Type Field data.
 *
 * @param {object} data
 * @returns {object}
 */
function normalizeInvestigationTypeFieldData(data = {}) {
    const allowedFieldTypes = [
        'TEXT',
        'TEXTAREA',
        'NUMBER',
        'DATE',
        'EMAIL',
        'PHONE',
        'SELECT',
        'RADIO',
        'CHECKBOX'
    ];

    const fieldKey = String(data.fieldKey ?? '').trim();
    const fieldLabel = String(data.fieldLabel ?? '').trim();
    const fieldType = String(data.fieldType ?? 'TEXT').trim().toUpperCase();
    const placeholder = String(data.placeholder ?? '').trim();
    const helpText = String(data.helpText ?? '').trim();

    if (!fieldKey) {
        throw new Error('Field key is required.');
    }

    if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(fieldKey)) {
        throw new Error(
            'Field key may contain only letters, numbers, and underscores, and must begin with a letter.'
        );
    }

    if (!fieldLabel) {
        throw new Error('Field label is required.');
    }

    if (!allowedFieldTypes.includes(fieldType)) {
        throw new Error('Invalid Investigation Type Field type.');
    }

    const displayOrder = Number(data.displayOrder);

    if (!Number.isInteger(displayOrder) || displayOrder < 1) {
        throw new Error('Display order must be a positive whole number.');
    }

    const isRequired =
        data.isRequired === true ||
        data.isRequired === 1 ||
        data.isRequired === '1' ||
        data.isRequired === 'true';

    const isActive =
        data.isActive === undefined
            ? true
            : (
                data.isActive === true ||
                data.isActive === 1 ||
                data.isActive === '1' ||
                data.isActive === 'true'
            );

    const options = normalizeInvestigationTypeFieldOptions(
        fieldType,
        data.options
    );

    return {
        fieldKey,
        fieldLabel,
        fieldType,
        placeholder: placeholder || null,
        helpText: helpText || null,
        options: options === null ? null : JSON.stringify(options),
        isRequired,
        isActive,
        displayOrder
    };
}

/**
 * Confirm that an Investigation Type exists.
 *
 * @param {number} investigationTypeId
 * @returns {Promise<object|null>}
 */
async function getInvestigationTypeForFieldManagement(
    investigationTypeId
) {

    const [rows] = await pool.query(
        `
        SELECT
            id,
            code,
            name,
            is_active
        FROM investigation_types
        WHERE id = ?
        LIMIT 1
        `,
        [investigationTypeId]
    );

    return rows[0] || null;
}

/**
 * Count active required fields for an Investigation Type.
 *
 * @param {object} connection
 * @param {number} investigationTypeId
 * @returns {Promise<number>}
 */
async function countActiveRequiredInvestigationTypeFields(
    connection,
    investigationTypeId
) {
    const [rows] = await connection.query(
        `
        SELECT COUNT(*) AS count
        FROM investigation_type_fields
        WHERE investigation_type_id = ?
          AND is_active = 1
          AND is_required = 1
        `,
        [investigationTypeId]
    );

    return Number(rows[0].count);
}

/**
 * Ensure an active Investigation Type has at least one active required field.
 *
 * @param {object} connection
 * @param {number} investigationTypeId
 */
async function assertInvestigationTypeHasRequiredField(
    connection,
    investigationTypeId
) {
    const count = await countActiveRequiredInvestigationTypeFields(
        connection,
        investigationTypeId
    );

    if (count < 1) {
        throw new Error(
            'An active Investigation Type must have at least one active required field.'
        );
    }
}

/**
 * Create an Investigation Type Field.
 *
 * @param {number} investigationTypeId
 * @param {object} data
 * @returns {Promise<object>}
 */
async function createInvestigationTypeField(
    investigationTypeId,
    data
) {
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const investigationType =
            await getInvestigationTypeForFieldManagement(
                investigationTypeId
            );

        if (!investigationType) {
            throw new Error('Investigation Type not found.');
        }

        const normalized = normalizeInvestigationTypeFieldData(data);

        const [existing] = await connection.query(
            `
            SELECT id
            FROM investigation_type_fields
            WHERE investigation_type_id = ?
              AND field_key = ?
            LIMIT 1
            `,
            [investigationTypeId, normalized.fieldKey]
        );

        if (existing.length > 0) {
            throw new Error(
                'A field with this field key already exists for this Investigation Type.'
            );
        }

        const [result] = await connection.query(
            `
            INSERT INTO investigation_type_fields
                (
                    investigation_type_id,
                    field_key,
                    field_label,
                    field_type,
                    placeholder,
                    help_text,
                    options,
                    is_required,
                    display_order,
                    is_active
                )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            [
                investigationTypeId,
                normalized.fieldKey,
                normalized.fieldLabel,
                normalized.fieldType,
                normalized.placeholder,
                normalized.helpText,
                normalized.options,
                normalized.isRequired ? 1 : 0,
                normalized.displayOrder,
                normalized.isActive ? 1 : 0
            ]
        );

        /*
         * If the Investigation Type is active, it must have at least
         * one active required field before the transaction can commit.
         */
        if (investigationType.is_active) {
            await assertInvestigationTypeHasRequiredField(
                connection,
                investigationTypeId
            );
        }

        await connection.commit();

        return getInvestigationTypeFieldById(
            investigationTypeId,
            result.insertId
        );
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

/**
 * Update an Investigation Type Field.
 *
 * @param {number} investigationTypeId
 * @param {number} fieldId
 * @param {object} data
 * @returns {Promise<object>}
 */
async function updateInvestigationTypeField(
    investigationTypeId,
    fieldId,
    data
) {
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const investigationType =
            await getInvestigationTypeForFieldManagement(
                investigationTypeId
            );

        if (!investigationType) {
            throw new Error('Investigation Type not found.');
        }

        const [fieldRows] = await connection.query(
            `
            SELECT *
            FROM investigation_type_fields
            WHERE investigation_type_id = ?
              AND id = ?
            LIMIT 1
            `,
            [investigationTypeId, fieldId]
        );

        if (fieldRows.length === 0) {
            throw new Error('Investigation Type Field not found.');
        }

        const normalized = normalizeInvestigationTypeFieldData(data);

        const [duplicateRows] = await connection.query(
            `
            SELECT id
            FROM investigation_type_fields
            WHERE investigation_type_id = ?
              AND field_key = ?
              AND id <> ?
            LIMIT 1
            `,
            [investigationTypeId, normalized.fieldKey, fieldId]
        );

        if (duplicateRows.length > 0) {
            throw new Error(
                'A field with this field key already exists for this Investigation Type.'
            );
        }

        await connection.query(
            `
            UPDATE investigation_type_fields
            SET
                field_key = ?,
                field_label = ?,
                field_type = ?,
                placeholder = ?,
                help_text = ?,
                options = ?,
                is_required = ?,
                display_order = ?,
                is_active = ?
            WHERE id = ?
              AND investigation_type_id = ?
            `,
            [
                normalized.fieldKey,
                normalized.fieldLabel,
                normalized.fieldType,
                normalized.placeholder,
                normalized.helpText,
                normalized.options,
                normalized.isRequired ? 1 : 0,
                normalized.displayOrder,
                normalized.isActive ? 1 : 0,
                fieldId,
                investigationTypeId
            ]
        );

        if (investigationType.is_active) {
            await assertInvestigationTypeHasRequiredField(
                connection,
                investigationTypeId
            );
        }

        await connection.commit();

        return getInvestigationTypeFieldById(
            investigationTypeId,
            fieldId
        );
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

/**
 * Toggle an Investigation Type Field.
 *
 * An active Investigation Type cannot lose its final active required
 * field.
 *
 * @param {number} investigationTypeId
 * @param {number} fieldId
 * @returns {Promise<object>}
 */
async function toggleInvestigationTypeField(
    investigationTypeId,
    fieldId
) {
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const investigationType =
            await getInvestigationTypeForFieldManagement(
                investigationTypeId
            );

        if (!investigationType) {
            throw new Error('Investigation Type not found.');
        }

        const [fieldRows] = await connection.query(
            `
            SELECT
                id,
                is_active,
                is_required
            FROM investigation_type_fields
            WHERE investigation_type_id = ?
              AND id = ?
            LIMIT 1
            `,
            [investigationTypeId, fieldId]
        );

        if (fieldRows.length === 0) {
            throw new Error('Investigation Type Field not found.');
        }

        const field = fieldRows[0];
        const newActiveState = field.is_active ? 0 : 1;

        if (
            investigationType.is_active &&
            field.is_active &&
            field.is_required
        ) {
            const requiredCount =
                await countActiveRequiredInvestigationTypeFields(
                    connection,
                    investigationTypeId
                );

            if (requiredCount <= 1) {
                throw new Error(
                    'The last active required field cannot be deactivated while the Investigation Type is active.'
                );
            }
        }

        await connection.query(
            `
            UPDATE investigation_type_fields
            SET is_active = ?
            WHERE id = ?
              AND investigation_type_id = ?
            `,
            [newActiveState, fieldId, investigationTypeId]
        );

        if (investigationType.is_active) {
            await assertInvestigationTypeHasRequiredField(
                connection,
                investigationTypeId
            );
        }

        await connection.commit();

        return getInvestigationTypeFieldById(
            investigationTypeId,
            fieldId
        );
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

/**
 * Delete an Investigation Type Field only when it has never been used
 * by a submitted Investigation Request.
 *
 * @param {number} investigationTypeId
 * @param {number} fieldId
 * @returns {Promise<boolean>}
 */
async function deleteInvestigationTypeField(
    investigationTypeId,
    fieldId
) {
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const investigationType =
            await getInvestigationTypeForFieldManagement(
                investigationTypeId
            );

        if (!investigationType) {
            throw new Error('Investigation Type not found.');
        }

        const [fieldRows] = await connection.query(
            `
            SELECT
                id,
                is_active,
                is_required
            FROM investigation_type_fields
            WHERE investigation_type_id = ?
              AND id = ?
            LIMIT 1
            `,
            [investigationTypeId, fieldId]
        );

        if (fieldRows.length === 0) {
            throw new Error('Investigation Type Field not found.');
        }

        const field = fieldRows[0];

        const [usageRows] = await connection.query(
            `
            SELECT COUNT(*) AS count
            FROM investigation_request_service_fields
            WHERE investigation_type_field_id = ?
            `,
            [fieldId]
        );

        if (Number(usageRows[0].count) > 0) {
            throw new Error(
                'This Investigation Type Field has historical request data and cannot be deleted. Deactivate it instead.'
            );
        }

        if (
            investigationType.is_active &&
            field.is_active &&
            field.is_required
        ) {
            const requiredCount =
                await countActiveRequiredInvestigationTypeFields(
                    connection,
                    investigationTypeId
                );

            if (requiredCount <= 1) {
                throw new Error(
                    'The last active required field cannot be deleted while the Investigation Type is active.'
                );
            }
        }

        await connection.query(
            `
            DELETE FROM investigation_type_fields
            WHERE id = ?
              AND investigation_type_id = ?
            `,
            [fieldId, investigationTypeId]
        );

        if (investigationType.is_active) {
            await assertInvestigationTypeHasRequiredField(
                connection,
                investigationTypeId
            );
        }

        await connection.commit();

        return true;
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

module.exports = {

    getAllActiveInvestigationTypes,

    getAllInvestigationTypes,

    getInvestigationTypeById,

    createInvestigationType,

    updateInvestigationType,

    toggleInvestigationType,

    deleteInvestigationType,

    getInvestigationServices,

    getInvestigationTypeFields,

    getInvestigationTypeFieldById,

    createInvestigationTypeField,

    updateInvestigationTypeField,

    toggleInvestigationTypeField,

    deleteInvestigationTypeField

};