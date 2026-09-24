'use strict';

const crypto = require('crypto');

const pool =
    require('../config/database');

const userService =
    require('./user.service');

const notificationService =
    require('./notification.service');



const CLIENT_ROLE_ID = 4;

const CLIENT_ACCOUNT_ACTIVATION_EXPIRY_HOURS = 48;


/**
 * Normalize an international applicant phone number.
 *
 * The public NDUKA application accepts applicants from
 * Nigeria and the diaspora, so this deliberately does
 * not assume a Nigerian country code.
 *
 * Common formatting characters are removed and the
 * resulting number is stored in international form.
 *
 * Examples:
 *
 * +234 803 123 4567   -> +2348031234567
 * +44 (7700) 900123   -> +447700900123
 * +1 202-555-0123     -> +12025550123
 *
 * @param {string} phoneNumber
 * @returns {string}
 */
function normalizeInternationalPhoneNumber(
    phoneNumber
) {
    if (
        typeof phoneNumber !== 'string' ||
        !phoneNumber.trim()
    ) {
        throw new Error(
            'Applicant phone number is required.'
        );
    }

    let normalized =
        phoneNumber.trim();

    /*
     * Remove common formatting characters while
     * preserving the leading plus sign.
     *
     * Examples:
     * +234 813 355 2025 -> +2348133552025
     * +234-813-355-2025 -> +2348133552025
     * +234 (813) 355 2025 -> +2348133552025
     */
    normalized =
        normalized.replace(
            /[\s().-]/g,
            ''
        );

    /*
     * Nigerian domestic format:
     *
     * 08133552025 -> +2348133552025
     */
    if (
        /^0\d{10}$/.test(normalized)
    ) {
        normalized =
            `+234${normalized.slice(1)}`;
    }

    /*
     * Nigerian international format with
     * an unnecessary domestic leading zero:
     *
     * +23408133552025 -> +2348133552025
     */
    if (
        /^\+2340\d{10}$/.test(normalized)
    ) {
        normalized =
            `+234${normalized.slice(5)}`;
    }

    /*
     * International numbers must now use
     * the leading plus sign.
     */
    if (!normalized.startsWith('+')) {
        throw new Error(
            'Applicant phone number must be entered with a country code, for example +2348133552025 or 08133552025.'
        );
    }

    const digits =
        normalized.slice(1);

    if (!/^\d+$/.test(digits)) {
        throw new Error(
            'Applicant phone number contains invalid characters.'
        );
    }

    if (
        digits.length < 8 ||
        digits.length > 15
    ) {
        throw new Error(
            'Applicant phone number must contain between 8 and 15 digits.'
        );
    }

    return `+${digits}`;
}


/**
 * Validate an applicant email address.
 *
 * This is intentionally a practical application-level
 * validation rather than an attempt to implement the
 * complete RFC email grammar.
 *
 * @param {string} emailAddress
 * @returns {string}
 */
function validateApplicantEmail(
    emailAddress
) {

    if (
        typeof emailAddress !== 'string' ||
        !emailAddress.trim()
    ) {

        throw new Error(
            'Applicant email address is required.'
        );

    }


    const email =
        emailAddress.trim();


    if (email.length > 255) {

        throw new Error(
            'Applicant email address must not exceed 255 characters.'
        );

    }


    const emailPattern =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/;


    if (
        !emailPattern.test(email) ||
        email.includes('..')
    ) {

        throw new Error(
            'Please provide a valid applicant email address.'
        );

    }


    return email;
}


/**
 * Generate the random secret used only as the
 * internal initial password hash.
 *
 * The secret is never exposed to the Client.
 *
 * @returns {string}
 */
function generateClientTemporaryPassword() {

    return crypto
        .randomBytes(32)
        .toString('hex');
}


/**
 * Generate a one-time Client account activation token.
 *
 * @returns {string}
 */
function generateClientAccountActivationToken() {

    return crypto
        .randomBytes(32)
        .toString('hex');
}


/**
 * Hash a Client account activation token.
 *
 * @param {string} token
 * @returns {string}
 */
function hashClientAccountActivationToken(
    token
) {

    return crypto
        .createHash('sha256')
        .update(token)
        .digest('hex');
}


/**
 * Generate a unique Client account activation reference.
 *
 * @returns {string}
 */
function generateClientAccountActivationReference() {

    return `CAT-${crypto
        .randomBytes(8)
        .toString('hex')
        .toUpperCase()}`;
}



/**
 * Get active Client Types for the public request form.
 *
 * @returns {Promise<Array>}
 */

async function getActiveClientTypes() {

    const [clientTypes] =
        await pool.execute(
            `
            SELECT
                id,
                name,
                display_name,
                description
            FROM client_types
            ORDER BY
                display_order ASC,
                id ASC
            `
        );

    return clientTypes;
}


/**
 * Get active Investigation Types together with
 * their active dynamic fields.
 *
 * The returned structure is intentionally grouped
 * by Investigation Type so the public form can
 * render each service and its fields dynamically.
 *
 * @returns {Promise<Array>}
 */
async function getActiveInvestigationTypes() {

    const [types] =
        await pool.execute(
            `
            SELECT
                id,
                code,
                name,
                description,
                service_price,
                display_order
            FROM investigation_types
            WHERE is_active = 1
            ORDER BY
                display_order ASC,
                id ASC
            `
        );


    if (types.length === 0) {
        return [];
    }


    const typeIds =
        types.map(
            type => type.id
        );


    const placeholders =
        typeIds
            .map(() => '?')
            .join(', ');


    const [fields] =
        await pool.execute(
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
                display_order
            FROM investigation_type_fields
            WHERE is_active = 1
              AND investigation_type_id IN (${placeholders})
            ORDER BY
                investigation_type_id ASC,
                display_order ASC,
                id ASC
            `,
            typeIds
        );




/**
 * Get active Investigation Type Fields for the
 * public Investigation Request form.
 *
 * The returned catalogue is used by the public
 * form to dynamically render fields for the
 * selected Investigation Types.
 *
 * @returns {Promise<Array>}
 */


    const fieldsByType =
        new Map();


    for (const field of fields) {

        let options =
            field.options;

        if (
            typeof options === 'string' &&
            options.trim()
        ) {

            try {

                options =
                    JSON.parse(options);

            } catch (error) {

                options = null;

            }

        }


        const normalizedField = {
            ...field,
            options
        };


        if (!fieldsByType.has(field.investigation_type_id)) {

            fieldsByType.set(
                field.investigation_type_id,
                []
            );

        }


        fieldsByType
            .get(field.investigation_type_id)
            .push(normalizedField);

    }


    return types.map(type => ({
        ...type,
        fields:
            fieldsByType.get(type.id) || []
    }));
}




async function getActiveInvestigationTypeFields() {

    const [fields] =
        await pool.execute(
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
                display_order
            FROM investigation_type_fields
            WHERE is_active = 1
            ORDER BY
                investigation_type_id ASC,
                display_order ASC,
                id ASC
            `
        );

    return fields;
}


/**
 * Generate a public Investigation Request reference.
 *
 * @returns {string}
 */
function generateRequestReference() {

    const randomPart =
        crypto.randomBytes(6)
            .toString('hex')
            .toUpperCase();

    return `REQ-${randomPart}`;
}


/**
 * Normalize submitted service-field values.
 *
 * Expected submitted structure:
 *
 * serviceFields = {
 *     type_1: {
 *         field_1: value,
 *         field_2: value
 *     },
 *     type_2: {
 *         field_5: value
 *     }
 * }
 *
 * Numeric database IDs are deliberately prefixed in the
 * HTML field names so Express/qs does not interpret them
 * as JavaScript arrays.
 *
 * @param {Object} serviceFields
 * @returns {Object}
 */
function normalizeServiceFields(serviceFields) {

    if (
        !serviceFields ||
        typeof serviceFields !== 'object' ||
        Array.isArray(serviceFields)
    ) {

        return {};

    }


    const normalized = {};


    for (
        const [typeKey, fields]
        of Object.entries(serviceFields)
    ) {

        /*
         * Expected format:
         *
         * type_1
         * type_2
         */
        const typeMatch =
            /^type_(\d+)$/.exec(typeKey);


        if (!typeMatch) {
            continue;
        }


        const normalizedTypeId =
            Number(typeMatch[1]);


        if (
            !Number.isInteger(normalizedTypeId) ||
            normalizedTypeId <= 0 ||
            !fields ||
            typeof fields !== 'object' ||
            Array.isArray(fields)
        ) {

            continue;

        }


        normalized[normalizedTypeId] = {};


        for (
            const [fieldKey, value]
            of Object.entries(fields)
        ) {

            /*
             * Expected format:
             *
             * field_1
             * field_2
             */
            const fieldMatch =
                /^field_(\d+)$/.exec(fieldKey);


            if (!fieldMatch) {
                continue;
            }


            const normalizedFieldId =
                Number(fieldMatch[1]);


            if (
                !Number.isInteger(normalizedFieldId) ||
                normalizedFieldId <= 0
            ) {

                continue;

            }


            let normalizedValue =
                value;


            if (Array.isArray(value)) {

                normalizedValue =
                    value
                        .map(
                            item =>
                                String(item).trim()
                        )
                        .filter(Boolean);

            } else {

                normalizedValue =
                    value === null ||
                    typeof value === 'undefined'
                        ? ''
                        : String(value).trim();

            }


            normalized[normalizedTypeId][normalizedFieldId] =
                normalizedValue;

        }

    }


    return normalized;
}



/**
 * Create a public Investigation Request.
 *
 * The request, selected Investigation Types and
 * submitted service fields are created atomically.
 *
 * @param {Object} data
 * @returns {Promise<Object>}
 */
async function createInvestigationRequest(data) {

    const connection =
        await pool.getConnection();

    try {

        await connection.beginTransaction();


        /*
         * Normalize applicant information.
         */
        const clientTypeId =
            Number(data.clientTypeId);

        const applicantName =
            String(data.applicantName || '')
                .trim();

        const applicantPhone =
            normalizeInternationalPhoneNumber(
                String(data.applicantPhone || '')
                    .trim()
            );

        const applicantEmail =
            validateApplicantEmail(
                String(data.applicantEmail || '')
                    .trim()
            );

        const addressLine1 =
            data.addressLine1
                ? String(data.addressLine1).trim()
                : null;

        const addressLine2 =
            data.addressLine2
                ? String(data.addressLine2).trim()
                : null;

        const city =
            data.city
                ? String(data.city).trim()
                : null;

        const state =
            data.state
                ? String(data.state).trim()
                : null;

        const country =
            data.country
                ? String(data.country).trim()
                : null;

        const postalCode =
            data.postalCode
                ? String(data.postalCode).trim()
                : null;


        /*
         * Normalize investigation subject.
         */
        const subjectName =
            String(data.subjectName || '')
                .trim();

        const subjectPhone =
            data.subjectPhone
                ? String(data.subjectPhone).trim()
                : null;

        const subjectEmail =
            data.subjectEmail
                ? String(data.subjectEmail).trim()
                : null;


        /*
         * Normalize request information.
         */
        const caseTitle =
            String(data.caseTitle || '')
                .trim();

        const investigationPurpose =
            String(data.investigationPurpose || '')
                .trim();

        const additionalInformation =
            data.additionalInformation
                ? String(data.additionalInformation).trim()
                : null;


        /*
         * Normalize selected Investigation Types.
         */
        const investigationTypeIds =
            Array.from(
                new Set(
                    (Array.isArray(data.investigationTypeIds)
                        ? data.investigationTypeIds
                        : [data.investigationTypeIds]
                    )
                    .map(Number)
                    .filter(Number.isInteger)
                )
            );


        /*
         * Normalize dynamic service fields.
         */
        const serviceFields =
            normalizeServiceFields(
                data.serviceFields
            );


        /*
         * Validate required fields.
         */
        if (!Number.isInteger(clientTypeId) || clientTypeId <= 0) {
            throw new Error(
                'A valid Client Type is required.'
            );
        }

        if (!applicantName) {
            throw new Error(
                'Applicant name is required.'
            );
        }

        if (!subjectName) {
            throw new Error(
                'Investigation subject name is required.'
            );
        }

        if (!caseTitle) {
            throw new Error(
                'Case title is required.'
            );
        }

        if (!investigationPurpose) {
            throw new Error(
                'Investigation purpose is required.'
            );
        }

        if (investigationTypeIds.length === 0) {
            throw new Error(
                'Select at least one Investigation Type.'
            );
        }

        if (!data.consentConfirmed) {
            throw new Error(
                'You must confirm your consent before submitting an Investigation Request.'
            );
        }


        /*
         * Confirm Client Type exists.
         */
        const [clientTypes] =
            await connection.execute(
                `
                SELECT
                    id
                FROM client_types
                WHERE id = ?
                LIMIT 1
                `,
                [clientTypeId]
            );

        if (clientTypes.length === 0) {
            throw new Error(
                'Selected Client Type does not exist.'
            );
        }


        /*
         * Confirm all selected Investigation Types
         * are currently active.
         */
        const typePlaceholders =
            investigationTypeIds
                .map(() => '?')
                .join(', ');

        const [investigationTypes] =
            await connection.execute(
                `
                SELECT
                    id,
                    code,
                    name
                FROM investigation_types
                WHERE is_active = 1
                  AND id IN (${typePlaceholders})
                `,
                investigationTypeIds
            );

        if (
            investigationTypes.length !==
            investigationTypeIds.length
        ) {
            throw new Error(
                'One or more selected Investigation Types are invalid or inactive.'
            );
        }


        /*
         * Load the authoritative active fields for all
         * selected Investigation Types.
         *
         * The browser is never trusted to define which
         * fields belong to which Investigation Type.
         */
        const [investigationTypeFields] =
            await connection.execute(
                `
                SELECT
                    id,
                    investigation_type_id,
                    field_key,
                    field_label,
                    field_type,
                    is_required
                FROM investigation_type_fields
                WHERE is_active = 1
                  AND investigation_type_id IN (${typePlaceholders})
                ORDER BY
                    investigation_type_id ASC,
                    display_order ASC,
                    id ASC
                `,
                investigationTypeIds
            );


        /*
         * Index the authoritative field definitions.
         */
        const fieldsByType =
            new Map();


        for (const field of investigationTypeFields) {

            if (!fieldsByType.has(field.investigation_type_id)) {

                fieldsByType.set(
                    field.investigation_type_id,
                    new Map()
                );

            }


            fieldsByType
                .get(field.investigation_type_id)
                .set(
                    field.id,
                    field
                );

        }


        /*
         * Validate submitted service fields.
         *
         * A submitted field must:
         *
         * 1. Belong to a selected Investigation Type.
         * 2. Be an active field.
         * 3. Satisfy the required rule where applicable.
         */
        for (
            const investigationTypeId
            of investigationTypeIds
        ) {

            const fieldDefinitions =
                fieldsByType.get(
                    investigationTypeId
                ) || new Map();

            const submittedFields =
                serviceFields[investigationTypeId] || {};


            /*
             * Reject submitted fields that do not belong
             * to this Investigation Type.
             */
            for (
                const submittedFieldId
                of Object.keys(submittedFields)
            ) {

                const fieldId =
                    Number(submittedFieldId);

                if (
                    !Number.isInteger(fieldId) ||
                    !fieldDefinitions.has(fieldId)
                ) {

                    throw new Error(
                        'One or more submitted Investigation Service fields are invalid.'
                    );

                }

            }


            /*
             * Enforce required fields.
             */
            for (
                const field
                of fieldDefinitions.values()
            ) {

                if (!field.is_required) {
                    continue;
                }


                const value =
                    submittedFields[field.id];


                const hasValue =
                    Array.isArray(value)
                        ? value.length > 0
                        : String(value || '').trim() !== '';


                if (!hasValue) {

                    throw new Error(
                        `${field.field_label} is required for ${investigationTypes.find(
                            type => type.id === investigationTypeId
                        )?.name || 'the selected Investigation Type'}.`
                    );

                }

            }

        }


        /*
         * Reject service-field groups for Investigation Types
         * that were not selected.
         */
        for (
            const submittedTypeId
            of Object.keys(serviceFields)
        ) {

            const typeId =
                Number(submittedTypeId);

            if (
                !investigationTypeIds.includes(typeId)
            ) {

                throw new Error(
                    'Submitted Investigation Service fields contain an unselected Investigation Type.'
                );

            }

        }


        /*
         * Generate a unique request reference.
         */
        let requestReference;
        let referenceExists = true;

        while (referenceExists) {

            requestReference =
                generateRequestReference();

            const [existing] =
                await connection.execute(
                    `
                    SELECT
                        id
                    FROM investigation_requests
                    WHERE request_reference = ?
                    LIMIT 1
                    `,
                    [requestReference]
                );

            referenceExists =
                existing.length > 0;
        }


        /*
         * Create the Investigation Request.
         */
        const [requestResult] =
            await connection.execute(
                `
                INSERT INTO investigation_requests (
                    request_reference,
                    client_type_id,
                    applicant_name,
                    applicant_phone,
                    applicant_email,
                    address_line_1,
                    address_line_2,
                    city,
                    state,
                    country,
                    postal_code,
                    subject_name,
                    subject_phone,
                    subject_email,
                    case_title,
                    investigation_purpose,
                    additional_information,
                    consent_confirmed,
                    status
                )
                VALUES (
                    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?, ?, 1, 'PENDING'
                )
                `,
                [
                    requestReference,
                    clientTypeId,
                    applicantName,
                    applicantPhone,
                    applicantEmail,
                    addressLine1,
                    addressLine2,
                    city,
                    state,
                    country,
                    postalCode,
                    subjectName,
                    subjectPhone,
                    subjectEmail,
                    caseTitle,
                    investigationPurpose,
                    additionalInformation
                ]
            );


        const requestId =
            requestResult.insertId;


        /*
         * Create the requested Investigation Services
         * and their submitted field values.
         */
        for (
            const investigationTypeId
            of investigationTypeIds
        ) {

            const [serviceResult] =
                await connection.execute(
                    `
                    INSERT INTO investigation_request_services (
                        investigation_request_id,
                        investigation_type_id
                    )
                    VALUES (?, ?)
                    `,
                    [
                        requestId,
                        investigationTypeId
                    ]
                );


            const requestServiceId =
                serviceResult.insertId;


            const submittedFields =
                serviceFields[investigationTypeId] || {};


            /*
             * Store only fields that were actually supplied.
             */
            for (
                const [fieldId, value]
                of Object.entries(submittedFields)
            ) {

                const fieldDefinition =
                    fieldsByType
                        .get(investigationTypeId)
                        ?.get(Number(fieldId));


                if (!fieldDefinition) {
                    throw new Error(
                        'One or more submitted Investigation Service fields are invalid.'
                    );
                }


                let fieldValue;


                if (Array.isArray(value)) {

                    fieldValue =
                        JSON.stringify(value);

                } else {

                    fieldValue =
                        String(value);

                }


                if (
                    fieldValue.trim() === ''
                ) {

                    continue;

                }


                await connection.execute(
                    `
                    INSERT INTO investigation_request_service_fields (
                        investigation_request_service_id,
                        investigation_type_field_id,
                        field_value
                    )
                    VALUES (?, ?, ?)
                    `,
                    [
                        requestServiceId,
                        Number(fieldId),
                        fieldValue
                    ]
                );

            }

        }


        await connection.commit();


        return {
            id: requestId,
            requestReference
        };

    } catch (error) {

        await connection.rollback();

        throw error;

    } finally {

        connection.release();

    }
}





/**
 * Get Investigation Requests for authenticated staff review.
 *
 * This method is read-only.
 * It does not modify request status, Client records,
 * Case records, or audit logs.
 *
 * @returns {Promise<Array>}
 */
async function getInvestigationRequests() {

    const [requests] =
        await pool.execute(
            `
            SELECT
                ir.id,
                ir.request_reference,
                ir.applicant_name,
                ir.applicant_phone,
                ir.applicant_email,
                ir.subject_name,
                ir.case_title,
                ir.status,
                ir.reviewed_by,
                ir.reviewed_at,
                ir.created_at,
                ir.updated_at,
                ct.display_name AS client_type_name
            FROM investigation_requests ir
            INNER JOIN client_types ct
                ON ct.id = ir.client_type_id
            ORDER BY
                CASE ir.status
                    WHEN 'PENDING' THEN 1
                    WHEN 'ACCEPTED' THEN 2
                    WHEN 'REJECTED' THEN 3
                    ELSE 4
                END,
                ir.created_at DESC,
                ir.id DESC
            `
        );

    return requests;
}


/**
 * Get one complete Investigation Request.
 *
 * The request's original submitted particulars,
 * requested Investigation Services and submitted
 * dynamic field values are returned together.
 *
 * This method is read-only.
 *
 * @param {number} requestId
 * @returns {Promise<Object|null>}
 */
/**
 * Find an existing Client whose name exactly matches
 * an Investigation Request applicant name.
 *
 * This lookup is used only for staff identity resolution.
 * A matching name does not establish that the Client and
 * applicant are the same person.
 *
 * @param {string} applicantName
 * @returns {Promise<Object|null>}
 */
async function findClientByApplicantName(applicantName) {

    if (
        typeof applicantName !== 'string' ||
        !applicantName.trim()
    ) {
        return null;
    }


    const [rows] =
        await pool.execute(
            `
            SELECT
                c.id,
                c.client_code,
                c.name,
                c.client_type_id,
                ct.display_name AS client_type_name
            FROM clients c
            INNER JOIN client_types ct
                ON ct.id = c.client_type_id
            WHERE c.name = ?
            LIMIT 1
            `,
            [applicantName.trim()]
        );


    if (rows.length === 0) {
        return null;
    }


    return {
        id:
            rows[0].id,

        clientCode:
            rows[0].client_code,

        name:
            rows[0].name,

        clientTypeId:
            rows[0].client_type_id,

        clientTypeName:
            rows[0].client_type_name
    };
}


async function getInvestigationRequestById(requestId) {

    const id =
        Number(requestId);

    if (
        !Number.isInteger(id) ||
        id <= 0
    ) {
        return null;
    }


    /*
     * Get the main Investigation Request.
     */
    const [requests] =
        await pool.execute(
            `
            SELECT
                ir.id,
                ir.request_reference,
                ir.client_type_id,
                ct.name AS client_type_code,
                ct.display_name AS client_type_name,
                ct.description AS client_type_description,

                ir.applicant_name,
                ir.applicant_phone,
                ir.applicant_email,

                ir.address_line_1,
                ir.address_line_2,
                ir.city,
                ir.state,
                ir.country,
                ir.postal_code,

                ir.subject_name,
                ir.subject_phone,
                ir.subject_email,

                ir.case_title,
                ir.investigation_purpose,
                ir.additional_information,

                ir.consent_confirmed,
                ir.status,
                ir.rejection_reason,
                ir.reviewed_by,
                ir.reviewed_at,

                ir.client_id,
                ir.case_id,
                ir.client_resolution,

                ir.created_at,
                ir.updated_at
            FROM investigation_requests ir
            INNER JOIN client_types ct
                ON ct.id = ir.client_type_id
            WHERE ir.id = ?
            LIMIT 1
            `,
            [id]
        );


    if (requests.length === 0) {
        return null;
    }


    const request =
        requests[0];


    /*
     * Get requested Investigation Services and
     * their submitted dynamic field values.
     *
     * LEFT JOIN is deliberate so a service remains
     * visible even when no optional dynamic field
     * value was submitted.
     */
    const [services] =
        await pool.execute(
            `
            SELECT
                irs.id AS request_service_id,
                irs.investigation_type_id,

                it.code AS investigation_type_code,
                it.name AS investigation_type_name,
                it.description AS investigation_type_description,
                it.service_price AS investigation_type_service_price,
                it.display_order AS investigation_type_display_order,

                irsf.id AS service_field_id,
                irsf.investigation_type_field_id,
                irsf.field_value,

                itf.field_key,
                itf.field_label,
                itf.field_type,
                itf.placeholder,
                itf.help_text,
                itf.options,
                itf.is_required,
                itf.display_order AS field_display_order,
                itf.is_active AS field_is_active

            FROM investigation_request_services irs

            INNER JOIN investigation_types it
                ON it.id = irs.investigation_type_id

            LEFT JOIN investigation_request_service_fields irsf
                ON irsf.investigation_request_service_id = irs.id

            LEFT JOIN investigation_type_fields itf
                ON itf.id = irsf.investigation_type_field_id

            WHERE irs.investigation_request_id = ?

            ORDER BY
                it.display_order ASC,
                it.id ASC,
                itf.display_order ASC,
                itf.id ASC,
                irsf.id ASC
            `,
            [id]
        );


    /*
     * Group the flat service/field result into the
     * structure expected by the detail view.
     */
    const servicesById =
        new Map();


    for (const row of services) {

        if (!servicesById.has(row.request_service_id)) {

            servicesById.set(
                row.request_service_id,
                {
                    id: row.request_service_id,
                    investigation_type_id:
                        row.investigation_type_id,
                    investigation_type_code:
                        row.investigation_type_code,
                    investigation_type_name:
                        row.investigation_type_name,
                    investigation_type_description:
                        row.investigation_type_description,

                    investigation_type_service_price:
                        row.investigation_type_service_price,

                     display_order:
                         row.investigation_type_display_order,

                      fields: []
                }
            );

        }


        /*
         * A service with no submitted dynamic fields
         * will have NULL field columns because of the
         * LEFT JOIN.
         */
        if (
            row.investigation_type_field_id !== null
        ) {

            let options =
                row.options;


            /*
             * mysql2 may return JSON columns as strings.
             */
            if (
                typeof options === 'string' &&
                options.trim()
            ) {

                try {

                    options =
                        JSON.parse(options);

                } catch (error) {

                    options = null;

                }

            }


            servicesById
                .get(row.request_service_id)
                .fields
                .push({
                    id:
                        row.service_field_id,
                    investigation_type_field_id:
                        row.investigation_type_field_id,
                    field_key:
                        row.field_key,
                    field_label:
                        row.field_label,
                    field_type:
                        row.field_type,
                    placeholder:
                        row.placeholder,
                    help_text:
                        row.help_text,
                    options,
                    is_required:
                        row.is_required,
                    display_order:
                        row.field_display_order,
                    is_active:
                        row.field_is_active,
                    field_value:
                        row.field_value
                });

        }

    }


    request.services =
        Array.from(
            servicesById.values()
        );


    /*
     * Get the most recent payment attempt for this
     * Investigation Request.
     *
     * Payment history is preserved because multiple
     * attempts may exist after FAILED or CANCELLED
     * payments.
     */
    const [payments] =
        await pool.execute(
            `
            SELECT
                id,
                payment_reference,
                gateway_name,
                gateway_reference,
                amount,
                currency,
                status,
                initiated_at,
                paid_at,
                created_at,
                updated_at
            FROM investigation_request_payments
            WHERE investigation_request_id = ?
            ORDER BY
                id DESC
            LIMIT 1
            `,
            [id]
        );


    request.payment =
        payments.length > 0
            ? {
                id:
                    payments[0].id,

                paymentReference:
                    payments[0].payment_reference,

                gatewayName:
                    payments[0].gateway_name,

                gatewayReference:
                    payments[0].gateway_reference,

                amount:
                    Number(payments[0].amount || 0),

                currency:
                    payments[0].currency,

                status:
                    payments[0].status,

                initiatedAt:
                    payments[0].initiated_at,

                paidAt:
                    payments[0].paid_at,

                createdAt:
                    payments[0].created_at,

                updatedAt:
                    payments[0].updated_at
            }
            : null;


    return request;
}





/**
 * Accept a pending Investigation Request.
 *
 * Acceptance only changes the request workflow state.
 * It does NOT create a Client, Case or Investigation
 * Service at this stage.
 *
 * @param {number} requestId
 * @param {number} reviewedBy
 * @returns {Promise<Object>}
 */
async function acceptInvestigationRequest(requestId, reviewedBy) {

    const id =
        Number(requestId);

    const reviewerId =
        Number(reviewedBy);


    if (
        !Number.isInteger(id) ||
        id <= 0
    ) {
        throw new Error(
            'A valid Investigation Request is required.'
        );
    }


    if (
        !Number.isInteger(reviewerId) ||
        reviewerId <= 0
    ) {
        throw new Error(
            'A valid reviewer is required.'
        );
    }


    const connection =
        await pool.getConnection();

    try {

        await connection.beginTransaction();


        /*
         * Lock the request while it is being reviewed.
         *
         * This prevents two authenticated staff members
         * from accepting/rejecting the same pending
         * request concurrently.
         */
        const [requests] =
            await connection.execute(
                `
                SELECT
                    id,
                    request_reference,
                    status,
                    client_id,
                    case_id
                FROM investigation_requests
                WHERE id = ?
                LIMIT 1
                FOR UPDATE
                `,
                [id]
            );


        if (requests.length === 0) {

            throw new Error(
                'Investigation Request not found.'
            );

        }


        const request =
            requests[0];


        /*
         * Only PENDING requests may be accepted.
         *
         * Existing ACCEPTED or REJECTED requests
         * must never be silently re-processed.
         */
        if (request.status !== 'PENDING') {

            throw new Error(
                `Investigation Request ${request.request_reference} has already been ${request.status.toLowerCase()}.`
            );

        }


        /*
         * Acceptance does not create or link a Client
         * or Case at this stage.
         *
         * Preserve any existing values rather than
         * overwriting them.
         */
        const [result] =
            await connection.execute(
                `
                UPDATE investigation_requests
                SET
                    status = 'ACCEPTED',
                    reviewed_by = ?,
                    reviewed_at = CURRENT_TIMESTAMP
                WHERE id = ?
                  AND status = 'PENDING'
                `,
                [
                    reviewerId,
                    id
                ]
            );


        if (result.affectedRows !== 1) {

            throw new Error(
                'Investigation Request could not be accepted.'
            );

        }


        await connection.commit();


        return {
            id: request.id,
            requestReference:
                request.request_reference,
            status: 'ACCEPTED',
            reviewedBy: reviewerId,
            clientId:
                request.client_id,
            caseId:
                request.case_id
        };

    } catch (error) {

        await connection.rollback();

        throw error;

    } finally {

        connection.release();

    }
}




/**
 * Reject an Investigation Request.
 *
 * Rejection only changes the request workflow state.
 * It does NOT create a Client, Case or Investigation
 * Service at this stage.
 *
 * @param {number} requestId
 * @param {number} reviewedBy
 * @param {string} rejectionReason
 * @returns {Promise<Object>}
 */
async function rejectInvestigationRequest(
    requestId,
    reviewedBy,
    rejectionReason
) {

    const id =
        Number(requestId);

    const reviewerId =
        Number(reviewedBy);


    if (
        !Number.isInteger(id) ||
        id <= 0
    ) {
        throw new Error(
            'A valid Investigation Request is required.'
        );
    }


    if (
        !Number.isInteger(reviewerId) ||
        reviewerId <= 0
    ) {
        throw new Error(
            'A valid reviewer is required.'
        );
    }


    if (
        typeof rejectionReason !== 'string' ||
        !rejectionReason.trim()
    ) {
        throw new Error(
            'A rejection reason is required.'
        );
    }


    const reason =
        rejectionReason.trim();


    if (reason.length > 2000) {
        throw new Error(
            'The rejection reason must not exceed 2000 characters.'
        );
    }


    const connection =
        await pool.getConnection();

    try {

        await connection.beginTransaction();


        /*
         * Lock the request while it is being reviewed.
         *
         * This prevents two authenticated staff members
         * from accepting/rejecting the same pending
         * request concurrently.
         */
        const [requests] =
            await connection.execute(
                `
                SELECT
                    id,
                    request_reference,
                    status,
                    client_id,
                    case_id
                FROM investigation_requests
                WHERE id = ?
                LIMIT 1
                FOR UPDATE
                `,
                [id]
            );


        if (requests.length === 0) {

            throw new Error(
                'Investigation Request not found.'
            );

        }


        const request =
            requests[0];


        /*
         * Only PENDING requests may be rejected.
         *
         * Existing ACCEPTED or REJECTED requests
         * must never be silently re-processed.
         */
        if (request.status !== 'PENDING') {

            throw new Error(
                `Investigation Request ${request.request_reference} has already been ${request.status.toLowerCase()}.`
            );

        }


        /*
         * Rejection does not create or link a Client
         * or Case at this stage.
         *
         * Preserve any existing values rather than
         * overwriting them.
         */
        const [result] =
            await connection.execute(
                `
                UPDATE investigation_requests
                SET
                    status = 'REJECTED',
                    rejection_reason = ?,
                    reviewed_by = ?,
                    reviewed_at = CURRENT_TIMESTAMP
                WHERE id = ?
                  AND status = 'PENDING'
                `,
                [
                    reason,
                    reviewerId,
                    id
                ]
            );


        if (result.affectedRows !== 1) {

            throw new Error(
                'Investigation Request could not be rejected.'
            );

        }


        await connection.commit();


        return {
            id: request.id,
            requestReference:
                request.request_reference,
            status: 'REJECTED',
            rejectionReason:
                reason,
            reviewedBy: reviewerId,
            clientId:
                request.client_id,
            caseId:
                request.case_id
        };

    } catch (error) {

        await connection.rollback();

        throw error;

    } finally {

        connection.release();

    }
}



/**
 * Initialize a payment transaction for an accepted
 * Investigation Request.
 *
 * This function only creates the internal NDUKA payment
 * transaction and its service-price snapshots.
 *
 * It does NOT:
 * - process a gateway payment;
 * - mark the payment as successful;
 * - create a Client;
 * - create a Case;
 * - create Case Investigation Services.
 *
 * @param {number} requestId
 * @returns {Promise<Object>}
 */
async function initializeInvestigationRequestPayment(
    requestId
) {

    const id =
        Number(requestId);


    if (
        !Number.isInteger(id) ||
        id <= 0
    ) {
        throw new Error(
            'A valid Investigation Request is required.'
        );
    }


    const connection =
        await pool.getConnection();


    try {

        await connection.beginTransaction();


        /*
         * Lock the accepted request while its payment
         * transaction is being initialized.
         */
        const [requests] =
            await connection.execute(
                `
                SELECT
                    id,
                    request_reference,
                    status,
                    client_id,
                    case_id
                FROM investigation_requests
                WHERE id = ?
                LIMIT 1
                FOR UPDATE
                `,
                [id]
            );


        if (requests.length === 0) {

            throw new Error(
                'Investigation Request not found.'
            );

        }


        const request =
            requests[0];


        if (request.status !== 'ACCEPTED') {

            throw new Error(
                `Investigation Request ${request.request_reference} must be accepted before payment can be initialized.`
            );

        }


        /*
         * Retrieve the services currently attached to the
         * accepted Investigation Request and their configured
         * prices.
         */
        const [services] =
            await connection.execute(
                `
                SELECT
                    irs.investigation_type_id,
                    it.name AS service_name,
                    it.service_price,
                    it.is_active
                FROM investigation_request_services irs
                INNER JOIN investigation_types it
                    ON it.id = irs.investigation_type_id
                WHERE irs.investigation_request_id = ?
                ORDER BY
                    it.display_order ASC,
                    it.id ASC
                `,
                [id]
            );


        if (services.length === 0) {

            throw new Error(
                `Investigation Request ${request.request_reference} has no Investigation Services selected.`
            );

        }


        /*
         * Payment must not be prepared when any requested
         * Investigation Service has become inactive.
         *
         * We deliberately preserve the original
         * investigation_request_services rows so the submitted
         * request history remains intact.
         */
        const inactiveServices =
            services.filter(
                service =>
                    Number(service.is_active) !== 1
            );


        if (inactiveServices.length > 0) {

            const inactiveServiceNames =
                inactiveServices
                    .map(
                        service =>
                            service.service_name
                    )
                    .join(', ');


            throw new Error(
                `Payment cannot be prepared because the following Investigation Service(s) are no longer available: ${inactiveServiceNames}. The visitor must remove the unavailable service(s) before payment can proceed.`
            );

        }


        /*
         * Calculate the amount entirely from server-side
         * configuration. The browser never supplies the amount.
         */
        const amount =
            services.reduce(
                (total, service) =>
                    total +
                    Number(service.service_price || 0),
                0
            );


        /*
         * Check for an existing payment attempt before creating
         * another one.
         *
         * PENDING and INITIATED payments are reusable active
         * attempts. A SUCCESSFUL payment is terminal and must
         * never be replaced. FAILED and CANCELLED attempts are
         * historical and permit a new payment attempt.
         */
        const [existingPayments] =
            await connection.execute(
                `
                SELECT
                    id,
                    payment_reference,
                    gateway_name,
                    gateway_reference,
                    amount,
                    currency,
                    status,
                    initiated_at,
                    paid_at,
                    created_at,
                    updated_at
                FROM investigation_request_payments
                WHERE investigation_request_id = ?
                ORDER BY
                    id DESC
                LIMIT 1
                `,
                [id]
            );


        if (existingPayments.length > 0) {

            const existingPayment =
                existingPayments[0];


            if (
                existingPayment.status === 'PENDING' ||
                existingPayment.status === 'INITIATED' ||
                existingPayment.status === 'SUCCESSFUL'
            ) {

                await connection.commit();

                return {
                    id:
                        existingPayment.id,

                    requestId:
                        request.id,

                    requestReference:
                        request.request_reference,

                    paymentReference:
                        existingPayment.payment_reference,

                    amount:
                        Number(existingPayment.amount || 0),

                    currency:
                        existingPayment.currency,

                    status:
                        existingPayment.status,

                    gatewayName:
                        existingPayment.gateway_name,

                    gatewayReference:
                        existingPayment.gateway_reference,

                    initiatedAt:
                        existingPayment.initiated_at,

                    paidAt:
                        existingPayment.paid_at,

                    createdAt:
                        existingPayment.created_at,

                    updatedAt:
                        existingPayment.updated_at,

                    services:
                        services.map(service => ({
                            investigationTypeId:
                                service.investigation_type_id,

                            serviceName:
                                service.service_name,

                            unitAmount:
                                Number(
                                    service.service_price || 0
                                )
                        })),

                    clientId:
                        request.client_id,

                    caseId:
                        request.case_id,

                    created:
                        false,

                    reused:
                        true
                };

            }

        }


        /*
         * Generate a unique internal NDUKA payment reference.
         *
         * The gateway reference is deliberately kept separate
         * and will only be populated during gateway integration.
         */
        let paymentReference;
        let referenceExists = true;

        while (referenceExists) {

            paymentReference =
                `PAY-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;

            const [existing] =
                await connection.execute(
                    `
                    SELECT
                        id
                    FROM investigation_request_payments
                    WHERE payment_reference = ?
                    LIMIT 1
                    `,
                    [paymentReference]
                );

            referenceExists =
                existing.length > 0;
        }


        /*
         * Create the internal payment transaction.
         *
         * PENDING means the payment record exists but no
         * payment gateway transaction has been started yet.
         */
        const [paymentResult] =
            await connection.execute(
                `
                INSERT INTO investigation_request_payments (
                    investigation_request_id,
                    payment_reference,
                    amount,
                    currency,
                    status
                )
                VALUES (?, ?, ?, 'NGN', 'PENDING')
                `,
                [
                    id,
                    paymentReference,
                    amount
                ]
            );


        const paymentId =
            paymentResult.insertId;


        /*
         * Preserve a price snapshot for every requested
         * Investigation Service.
         */
        for (const service of services) {

            await connection.execute(
                `
                INSERT INTO investigation_request_payment_items (
                    payment_id,
                    investigation_type_id,
                    service_name,
                    unit_amount
                )
                VALUES (?, ?, ?, ?)
                `,
                [
                    paymentId,
                    service.investigation_type_id,
                    service.service_name,
                    Number(service.service_price || 0)
                ]
            );

        }


        await connection.commit();


        return {
            id: paymentId,

            requestId:
                request.id,

            requestReference:
                request.request_reference,

            paymentReference,

            amount,

            currency:
                'NGN',

            status:
                'PENDING',

            services:
                services.map(service => ({
                    investigationTypeId:
                        service.investigation_type_id,

                    serviceName:
                        service.service_name,

                    unitAmount:
                        Number(service.service_price || 0)
                })),

            clientId:
                request.client_id,

            caseId:
                request.case_id,

            created:
                true,

            reused:
                false
        };


    } catch (error) {

        await connection.rollback();

        throw error;

    } finally {

        connection.release();

    }
}


/**
 * Confirm an Investigation Request payment manually.
 *
 * This is a staff-only operation.
 *
 * It:
 * - locks the latest payment attempt;
 * - requires the payment to be INITIATED;
 * - marks it SUCCESSFUL;
 * - records MANUAL as the payment source;
 * - records the payment time.
 *
 * It does NOT:
 * - process a payment gateway;
 * - create a Client;
 * - create a Case;
 * - create Case Investigation Services.
 *
 * @param {number} requestId
 * @returns {Promise<Object>}
 */
async function confirmInvestigationRequestPayment(
    requestId,
    staffUserId
) {

    const id =
        Number(requestId);

    const staffId =
        Number(staffUserId);


    if (
        !Number.isInteger(id) ||
        id <= 0
    ) {
        throw new Error(
            'A valid Investigation Request is required.'
        );
    }


    if (
        !Number.isInteger(staffId) ||
        staffId <= 0
    ) {
        throw new Error(
            'A valid staff user is required.'
        );
    }


    const connection =
        await pool.getConnection();


    try {

        await connection.beginTransaction();


        /*
         * Lock the Investigation Request so that payment
         * confirmation cannot race with another workflow action.
         */
        const [requests] =
            await connection.execute(
                `
                SELECT
                    id,
                    request_reference,
                    status,
                    client_id,
                    case_id
                FROM investigation_requests
                WHERE id = ?
                LIMIT 1
                FOR UPDATE
                `,
                [id]
            );


        if (requests.length === 0) {

            throw new Error(
                'Investigation Request not found.'
            );

        }


        const request =
            requests[0];


        if (request.status !== 'ACCEPTED') {

            throw new Error(
                `Investigation Request ${request.request_reference} must be accepted before its payment can be confirmed.`
            );

        }


        /*
         * Lock the most recent payment attempt.
         */
        const [payments] =
            await connection.execute(
                `
                SELECT
                    id,
                    payment_reference,
                    gateway_name,
                    gateway_reference,
                    amount,
                    currency,
                    status,
                    initiated_at,
                    paid_at,
                    created_at,
                    updated_at
                FROM investigation_request_payments
                WHERE investigation_request_id = ?
                ORDER BY
                    id DESC
                LIMIT 1
                FOR UPDATE
                `,
                [id]
            );


        if (payments.length === 0) {

            throw new Error(
                `Investigation Request ${request.request_reference} has no payment prepared for confirmation.`
            );

        }


        const payment =
            payments[0];


        /*
         * A payment can only be manually confirmed after
         * the visitor has initiated the payment.
         */
        if (payment.status !== 'INITIATED') {

            if (payment.status === 'SUCCESSFUL') {

                throw new Error(
                    `Payment ${payment.payment_reference} has already been confirmed.`
                );

            }


            throw new Error(
                `Payment ${payment.payment_reference} cannot be confirmed because its current status is ${payment.status}.`
            );

        }


        /*
         * Mark the payment SUCCESSFUL inside this transaction.
         *
         * The change is deliberately NOT committed yet.
         *
         * The activation helper will see this SUCCESSFUL status
         * on the same connection. If activation fails, the
         * transaction rollback restores the previous INITIATED
         * state.
         */
        const [paymentUpdate] =
            await connection.execute(
                `
                UPDATE investigation_request_payments
                SET
                    status = 'SUCCESSFUL',
                    gateway_name = 'MANUAL',
                    paid_at = CURRENT_TIMESTAMP
                WHERE id = ?
                  AND status = 'INITIATED'
                `,
                [payment.id]
            );


        if (paymentUpdate.affectedRows !== 1) {

            throw new Error(
                `Payment ${payment.payment_reference} could not be confirmed.`
            );

        }


        /*
         * Perform Client resolution, Client creation/reuse,
         * Case creation, requested Service creation and
         * Investigation Request linking using THIS SAME
         * transaction.
         *
         * The helper requires a SUCCESSFUL payment. The
         * uncommitted payment update above is visible here
         * because both operations use the same transaction.
         */
        const activation =
            await _activateInvestigationRequestWithConnection(
                id,
                staffId,
                connection
            );


        /*
         * Only now is the complete business operation committed.
         */
        await connection.commit();


        return {
            id:
                payment.id,

            requestId:
                request.id,

            requestReference:
                request.request_reference,

            paymentReference:
                payment.payment_reference,

            amount:
                Number(payment.amount || 0),

            currency:
                payment.currency,

            status:
                'SUCCESSFUL',

            gatewayName:
                'MANUAL',

            gatewayReference:
                payment.gateway_reference,

            initiatedAt:
                payment.initiated_at,

            paidAt:
                new Date(),

            clientId:
                activation.clientId,

            caseId:
                activation.caseId,

            clientCode:
                activation.clientCode,

            caseReference:
                activation.caseReference,

            activated:
                activation.activated,

            paymentId:
                activation.paymentId,

            paymentAmount:
                activation.paymentAmount,

            paymentCurrency:
                activation.paymentCurrency,

            paymentStatus:
                activation.paymentStatus,

            clientUserAccountId:
                activation.clientUserAccountId,

            clientUserId:
                activation.clientUserId,

            clientAccountActivationReference:
                activation.clientAccountActivationReference,

            clientAccountActivationToken:
                activation.clientAccountActivationToken,

            clientAccountActivationExpiresAt:
                activation.clientAccountActivationExpiresAt,

            clientAccountNotificationRecords:
                activation.clientAccountNotificationRecords
        };


    } catch (error) {

        try {

            await connection.rollback();

        } catch (rollbackError) {

            console.error(
                'Failed to rollback payment confirmation transaction:',
                rollbackError
            );

        }


        throw error;


    } finally {

        connection.release();

    }

}




/**
 * Record a public visitor's intent to proceed with payment.
 *
 * This transitions an existing prepared payment attempt from
 * PENDING to INITIATED. It does not process a gateway payment
 * and must not mark the payment as successful.
 *
 * The method is intentionally idempotent so repeated visitor
 * clicks cannot create duplicate payment attempts.
 *
 * @param {string} requestReference
 * @returns {Promise<Object>}
 */
async function initiatePublicInvestigationRequestPayment(
    requestReference
) {

    const reference =
        String(requestReference || '')
            .trim()
            .toUpperCase();


    if (
        !/^REQ-[A-F0-9]{12}$/.test(reference)
    ) {
        throw new Error(
            'A valid Investigation Request Reference is required.'
        );
    }


    const connection =
        await pool.getConnection();


    try {

        await connection.beginTransaction();


        /*
         * Lock the Investigation Request while the public
         * visitor payment intent is being recorded.
         */
        const [requests] =
            await connection.execute(
                `
                SELECT
                    id,
                    request_reference,
                    status
                FROM investigation_requests
                WHERE request_reference = ?
                LIMIT 1
                FOR UPDATE
                `,
                [reference]
            );


        if (requests.length === 0) {

            throw new Error(
                'Investigation Request not found.'
            );

        }


        const request =
            requests[0];


        if (request.status !== 'ACCEPTED') {

            throw new Error(
                `Investigation Request ${request.request_reference} is not ready for payment.`
            );

        }


        /*
         * Retrieve and lock the most recent payment attempt.
         *
         * FAILED and CANCELLED attempts are historical. A new
         * staff-prepared payment attempt must exist before the
         * visitor can proceed again.
         */
        const [payments] =
            await connection.execute(
                `
                SELECT
                    id,
                    payment_reference,
                    amount,
                    currency,
                    status,
                    initiated_at,
                    paid_at,
                    created_at,
                    updated_at
                FROM investigation_request_payments
                WHERE investigation_request_id = ?
                ORDER BY
                    id DESC
                LIMIT 1
                FOR UPDATE
                `,
                [request.id]
            );


        if (payments.length === 0) {

            throw new Error(
                `No payment has been prepared yet for Investigation Request ${request.request_reference}.`
            );

        }


        const payment =
            payments[0];


        /*
         * PENDING → INITIATED represents a genuine public
         * visitor action indicating an intention to pay.
         */
        if (payment.status === 'PENDING') {

            await connection.execute(
                `
                UPDATE investigation_request_payments
                SET
                    status = 'INITIATED',
                    initiated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                  AND status = 'PENDING'
                `,
                [payment.id]
            );


            const [updatedPayments] =
                await connection.execute(
                    `
                    SELECT
                        id,
                        payment_reference,
                        amount,
                        currency,
                        status,
                        initiated_at,
                        paid_at,
                        created_at,
                        updated_at
                    FROM investigation_request_payments
                    WHERE id = ?
                    LIMIT 1
                    `,
                    [payment.id]
                );


            const updatedPayment =
                updatedPayments[0];


            await connection.commit();


            return {
                id:
                    updatedPayment.id,

                requestReference:
                    request.request_reference,

                paymentReference:
                    updatedPayment.payment_reference,

                amount:
                    Number(updatedPayment.amount || 0),

                currency:
                    updatedPayment.currency,

                status:
                    updatedPayment.status,

                initiatedAt:
                    updatedPayment.initiated_at,

                paidAt:
                    updatedPayment.paid_at,

                createdAt:
                    updatedPayment.created_at,

                updatedAt:
                    updatedPayment.updated_at,

                initiated:
                    true,

                reused:
                    false
            };

        }


        /*
         * Repeated visitor clicks are safe.
         *
         * INITIATED means the visitor has already expressed
         * payment intent and the payment attempt is awaiting
         * gateway processing or another configured next step.
         */
        if (payment.status === 'INITIATED') {

            await connection.commit();


            return {
                id:
                    payment.id,

                requestReference:
                    request.request_reference,

                paymentReference:
                    payment.payment_reference,

                amount:
                    Number(payment.amount || 0),

                currency:
                    payment.currency,

                status:
                    payment.status,

                initiatedAt:
                    payment.initiated_at,

                paidAt:
                    payment.paid_at,

                createdAt:
                    payment.created_at,

                updatedAt:
                    payment.updated_at,

                initiated:
                    false,

                reused:
                    true
            };

        }


        /*
         * A successful payment is terminal and must never be
         * re-initiated through the public endpoint.
         */
        if (payment.status === 'SUCCESSFUL') {

            throw new Error(
                `Payment ${payment.payment_reference} has already been successful.`
            );

        }


        /*
         * FAILED and CANCELLED attempts cannot be revived by
         * the visitor. Staff must prepare a new payment attempt.
         */
        throw new Error(
            `Payment ${payment.payment_reference} is ${payment.status.toLowerCase()} and cannot be initiated.`
        );


    } catch (error) {

        await connection.rollback();

        throw error;

    } finally {

        connection.release();

    }
}



/**
 * Get the public-safe status of an Investigation Request.
 *
 * This method deliberately exposes only information that a
 * public visitor needs to know about the progress of their
 * request. It must not expose applicant/subject particulars,
 * reviewer identity, client IDs, case IDs, or other internal data.
 *
 * @param {string} requestReference
 * @returns {Promise<Object|null>}
 */
async function getPublicInvestigationRequestStatus(
    requestReference
) {
    const reference =
        String(requestReference || '')
            .trim()
            .toUpperCase();

    if (
        !/^REQ-[A-F0-9]{12}$/.test(reference)
    ) {
        return null;
    }

    const [rows] = await pool.execute(
        `
            SELECT
                id,
                request_reference,
                status,
                created_at,
                reviewed_at,
                rejection_reason
            FROM investigation_requests
            WHERE request_reference = ?
            LIMIT 1
        `,
        [reference]
    );

    if (!rows.length) {
        return null;
    }

    const request = rows[0];

    const result = {
        requestReference:
            request.request_reference,

        status:
            request.status,

        createdAt:
            request.created_at,

        reviewedAt:
            request.reviewed_at,

        rejectionReason:
            request.status === 'REJECTED'
                ? request.rejection_reason
                : null,

        services: [],

        paymentTotal: 0,

        payment: null
    };


    /*
     * Service and pricing information is disclosed
     * publicly only after the request has been accepted.
     */
    if (request.status !== 'ACCEPTED') {
        return result;
    }


    const [serviceRows] = await pool.execute(
        `
            SELECT
                irs.investigation_type_id,
                it.name AS service_name,
                it.service_price
            FROM investigation_request_services irs
            INNER JOIN investigation_types it
                ON it.id = irs.investigation_type_id
            WHERE irs.investigation_request_id = ?
            ORDER BY
                it.display_order ASC,
                it.id ASC
        `,
        [request.id]
    );


    result.services =
        serviceRows.map(service => ({
            investigationTypeId:
                service.investigation_type_id,

            serviceName:
                service.service_name,

            servicePrice:
                Number(service.service_price || 0)
        }));


    result.paymentTotal =
        result.services.reduce(
            (total, service) =>
                total + service.servicePrice,
            0
        );


    /*
     * Expose only public-safe payment information.
     *
     * Gateway-specific details remain internal.
     */
    const [paymentRows] = await pool.execute(
        `
            SELECT
                payment_reference,
                amount,
                currency,
                status,
                initiated_at,
                paid_at,
                created_at
            FROM investigation_request_payments
            WHERE investigation_request_id = ?
            ORDER BY
                id DESC
            LIMIT 1
        `,
        [request.id]
    );


    if (paymentRows.length) {

        const payment =
            paymentRows[0];

        result.payment = {
            paymentReference:
                payment.payment_reference,

            amount:
                Number(payment.amount || 0),

            currency:
                payment.currency,

            status:
                payment.status,

            initiatedAt:
                payment.initiated_at,

            paidAt:
                payment.paid_at,

            createdAt:
                payment.created_at
        };

    }


    return result;
}





/**
 * Activate an accepted Investigation Request after
 * successful payment confirmation.
 *
 * This operation is intentionally transaction-aware.
 *
 * It does NOT call createClient(), createCase(), or
 * addInvestigationService() because those functions each
 * manage their own database transactions.
 *
 * The complete activation therefore happens on one
 * connection and within one database transaction.
 *
 * @param {number} requestId
 * @param {number} staffUserId
 * @returns {Promise<Object>}
 */

/**
 * Persist staff Client identity resolution for an
 * accepted Investigation Request.
 *
 * This operation deliberately records ONLY the
 * identity-resolution decision.
 *
 * It does NOT:
 * - create a Client;
 * - reuse/link a Client;
 * - create a Case;
 * - create Case Investigation Services;
 * - confirm or change payment status;
 * - activate the Investigation Request.
 *
 * Actual Client creation/reuse and Case activation remain
 * the responsibility of activateInvestigationRequest(),
 * after successful payment confirmation.
 *
 * @param {number} requestId
 * @param {string} resolutionType
 * @param {number|null} selectedClientId
 * @returns {Promise<Object>}
 */
async function resolveInvestigationRequestClient(
    requestId,
    resolutionType,
    selectedClientId = null
) {

    const id =
        Number(requestId);

    const resolution =
        String(
            resolutionType || ''
        )
            .trim()
            .toUpperCase();


    if (
        !Number.isInteger(id) ||
        id <= 0
    ) {

        throw new Error(
            'A valid Investigation Request is required.'
        );

    }


    if (
        ![
            'USE_EXISTING_CLIENT',
            'CREATE_NEW_CLIENT'
        ].includes(resolution)
    ) {

        throw new Error(
            'A valid Client identity-resolution choice is required.'
        );

    }


    const connection =
        await pool.getConnection();


    try {

        await connection.beginTransaction();


        /*
         * Lock the Investigation Request so that the
         * identity-resolution decision cannot race with
         * activation or another resolution attempt.
         */
        const [requestRows] =
            await connection.execute(
                `
                SELECT
                    id,
                    request_reference,
                    applicant_name,
                    status,
                    client_id,
                    case_id,
                    client_resolution
                FROM investigation_requests
                WHERE id = ?
                LIMIT 1
                FOR UPDATE
                `,
                [id]
            );


        if (requestRows.length === 0) {

            throw new Error(
                'Investigation Request not found.'
            );

        }


        const request =
            requestRows[0];


        if (request.status !== 'ACCEPTED') {

            throw new Error(
                'Only accepted Investigation Requests can have Client identity resolved.'
            );

        }


        /*
         * A request with an actual Client and Case linkage
         * has already been activated. Identity resolution must
         * not be changed after activation.
         */
        if (
            request.client_id !== null ||
            request.case_id !== null
        ) {

            throw new Error(
                'Investigation Request has already been activated.'
            );

        }


        /*
         * Identity resolution is intentionally persisted as
         * a separate decision from client_id.
         */
        if (
            request.client_resolution !== null
        ) {

            throw new Error(
                'Client identity for this Investigation Request has already been resolved.'
            );

        }


        /*
         * Confirm the same-name Client candidate.
         *
         * A matching name is the reason staff resolution is
         * required; it is not itself proof of identity.
         */
        const [matchingClientRows] =
            await connection.execute(
                `
                SELECT
                    id,
                    client_code,
                    name
                FROM clients
                WHERE name = ?
                LIMIT 1
                `,
                [request.applicant_name]
            );


        const matchingClient =
            matchingClientRows.length > 0
                ? matchingClientRows[0]
                : null;


        if (
            resolution ===
            'USE_EXISTING_CLIENT'
        ) {

            const clientId =
                Number(selectedClientId);


            if (
                !Number.isInteger(clientId) ||
                clientId <= 0
            ) {

                throw new Error(
                    'A valid existing Client must be selected.'
                );

            }


            /*
             * The selected Client must be the same-name
             * identity-resolution candidate.
             */
            if (
                !matchingClient ||
                Number(matchingClient.id) !==
                    clientId
            ) {

                throw new Error(
                    'The selected Client does not match the applicant identity-resolution candidate.'
                );

            }

        }


        /*
         * For CREATE_NEW_CLIENT, no Client is created here.
         * The decision is merely recorded for activation.
         *
         * This is especially important where a same-name
         * Client already exists: the actual new Client must
         * not be created until successful payment activation.
         */
        const [updateResult] =
            await connection.execute(
                `
                UPDATE investigation_requests
                SET
                    client_resolution = ?
                WHERE id = ?
                  AND status = 'ACCEPTED'
                  AND client_id IS NULL
                  AND case_id IS NULL
                  AND client_resolution IS NULL
                `,
                [
                    resolution,
                    id
                ]
            );


        if (
            updateResult.affectedRows !== 1
        ) {

            throw new Error(
                'Client identity resolution could not be recorded.'
            );

        }


        await connection.commit();


        return {
            resolved: true,
            requestId: request.id,
            requestReference:
                request.request_reference,
            resolution,
            matchingClientId:
                matchingClient
                    ? matchingClient.id
                    : null,
            matchingClientCode:
                matchingClient
                    ? matchingClient.client_code
                    : null
        };


    } catch (error) {

        try {

            await connection.rollback();

        } catch (rollbackError) {

            console.error(
                'Failed to rollback Client identity-resolution transaction:',
                rollbackError
            );

        }


        throw error;


    } finally {

        connection.release();

    }
}



async function _activateInvestigationRequestWithConnection(
    requestId,
    staffUserId,
    connection
) {

    requestId = Number(requestId);
    staffUserId = Number(staffUserId);

    if (
        !Number.isInteger(requestId) ||
        requestId <= 0
    ) {
        throw new Error(
            'Invalid Investigation Request ID.'
        );
    }

    if (
        !Number.isInteger(staffUserId) ||
        staffUserId <= 0
    ) {
        throw new Error(
            'Invalid staff user ID.'
        );
    }




        /*
         * Lock the Investigation Request so that two
         * staff actions cannot activate the same request
         * concurrently.
         */
        const [requestRows] =
            await connection.execute(
                `
                SELECT
                    id,
                    request_reference,
                    client_type_id,
                    applicant_name,
                    applicant_phone,
                    applicant_email,
                    address_line_1,
                    address_line_2,
                    city,
                    state,
                    country,
                    postal_code,
                    case_title,
                    investigation_purpose,
                    additional_information,
                    status,
                    client_id,
                    case_id,
                    client_resolution
                FROM investigation_requests
                WHERE id = ?
                FOR UPDATE
                `,
                [requestId]
            );


        if (requestRows.length === 0) {

            throw new Error(
                'Investigation Request not found.'
            );

        }


        const request =
            requestRows[0];


        /*
         * Activation is only valid for an accepted
         * Investigation Request.
         */
        if (request.status !== 'ACCEPTED') {

            throw new Error(
                'Only accepted Investigation Requests can be activated.'
            );

        }


        /*
         * Detect an inconsistent partially-linked state.
         *
         * We deliberately refuse to create another Client
         * or Case when only one side is populated.
         */
        const hasClient =
            request.client_id !== null;

        const hasCase =
            request.case_id !== null;


        if (hasClient !== hasCase) {

            throw new Error(
                'Investigation Request has an inconsistent Client/Case linkage and requires staff resolution.'
            );

        }


        /*
         * If both Client and Case already exist, activation
         * has already been completed.
         *
         * Verify that both referenced records still exist.
         */
        if (hasClient && hasCase) {

            const [clientRows] =
                await connection.execute(
                    `
                    SELECT
                        id
                    FROM clients
                    WHERE id = ?
                    LIMIT 1
                    `,
                    [request.client_id]
                );


            const [caseRows] =
                await connection.execute(
                    `
                    SELECT
                        id
                    FROM cases
                    WHERE id = ?
                    LIMIT 1
                    `,
                    [request.case_id]
                );


            if (
                clientRows.length === 0 ||
                caseRows.length === 0
            ) {

                throw new Error(
                    'Investigation Request references a missing Client or Case and requires staff resolution.'
                );

            }


            throw new Error(
                'Investigation Request has already been activated.'
            );

        }


        /*
         * Lock the latest payment attempt.
         *
         * Only an initiated payment may be manually
         * confirmed and converted into an activated
         * investigation.
         */
        const [paymentRows] =
            await connection.execute(
                `
                SELECT
                    id,
                    payment_reference,
                    amount,
                    currency,
                    status
                FROM investigation_request_payments
                WHERE investigation_request_id = ?
                ORDER BY
                    id DESC
                LIMIT 1
                FOR UPDATE
                `,
                [request.id]
            );


        if (paymentRows.length === 0) {

            throw new Error(
                'No payment has been prepared for this Investigation Request.'
            );

        }


        const payment =
            paymentRows[0];


        /*
         * Only a SUCCESSFUL payment may activate an
         * Investigation Request.
         *
         * INITIATED means that the visitor has expressed
         * an intention to proceed with payment. It does
         * not establish that payment has actually been
         * received or confirmed.
         */
        if (payment.status !== 'SUCCESSFUL') {

            throw new Error(
                'Only a successful payment can activate this Investigation Request.'
            );

        }


        /*
         * Validate all requested Investigation Services before
         * resolving or creating a Client.
         *
         * This is an activation gate. An Investigation Request
         * must not create/reuse a Client or Case if any requested
         * Investigation Service no longer exists or is inactive.
         */
        const [requestedServiceRows] =
            await connection.execute(
                `
                SELECT
                    irs.investigation_type_id,
                    it.name AS service_name,
                    it.is_active
                FROM investigation_request_services irs
                LEFT JOIN investigation_types it
                    ON it.id = irs.investigation_type_id
                WHERE irs.investigation_request_id = ?
                ORDER BY
                    COALESCE(it.display_order, 999999) ASC,
                    irs.investigation_type_id ASC
                `,
                [request.id]
            );


        if (requestedServiceRows.length === 0) {

            throw new Error(
                'Investigation Request has no Investigation Services.'
            );

        }


        const missingServices =
            requestedServiceRows.filter(
                service =>
                    service.service_name === null
            );


        if (missingServices.length > 0) {

            throw new Error(
                'An Investigation Service referenced by the request no longer exists.'
            );

        }


        const inactiveServices =
            requestedServiceRows.filter(
                service =>
                    Number(service.is_active) !== 1
            );


        if (inactiveServices.length > 0) {

            const inactiveServiceNames =
                inactiveServices
                    .map(
                        service =>
                            service.service_name
                    )
                    .join(', ');

            throw new Error(
                `Investigation Service(s) "${inactiveServiceNames}" are no longer active and cannot be used to activate this Investigation Request.`
            );

        }


        /*
         * Resolve the applicant's Client.
         *
         * We intentionally do NOT automatically link an
         * existing Client by name because names are not a
         * sufficient identity key.
         */
        const [existingClientRows] =
            await connection.execute(
                `
                SELECT
                    id,
                    client_type_id,
                    client_code,
                    name
                FROM clients
                WHERE name = ?
                LIMIT 1
                `,
                [request.applicant_name]
            );


        /*
         * A matching name is not sufficient to establish
         * that the applicant and existing Client are the
         * same person.
         *
         * The staff identity-resolution decision was already
         * persisted separately on the Investigation Request.
         * Activation reads that persisted decision and does
         * not accept a transient resolution object.
         */
        let resolvedClientId = null;

        let clientResolution =
            'CREATE_NEW_CLIENT';


        if (existingClientRows.length > 0) {

            if (
                !request.client_resolution ||
                ![
                    'USE_EXISTING_CLIENT',
                    'CREATE_NEW_CLIENT'
                ].includes(request.client_resolution)
            ) {

                throw new Error(
                    'A Client with the applicant name already exists. Staff must resolve the Client identity before this Investigation Request can be activated.'
                );

            }


            clientResolution =
                request.client_resolution;


            if (
                clientResolution ===
                'USE_EXISTING_CLIENT'
            ) {

                const matchingClient =
                    existingClientRows[0];


                resolvedClientId =
                    Number(matchingClient.id);


                if (
                    !Number.isInteger(resolvedClientId) ||
                    resolvedClientId <= 0
                ) {

                    throw new Error(
                        'The resolved existing Client could not be found.'
                    );

                }

            }

        }


        /*
         * Confirm the requested Client Type exists.
         */
        const [clientTypeRows] =
            await connection.execute(
                `
                SELECT
                    id
                FROM client_types
                WHERE id = ?
                LIMIT 1
                `,
                [request.client_type_id]
            );


        if (clientTypeRows.length === 0) {

            throw new Error(
                'The Investigation Request references an invalid Client Type.'
            );

        }


        /*
         * Resolve the final Client ID.
         *
         * If staff selected an existing Client, we reuse
         * that Client and do NOT create another record.
         *
         * Otherwise, create a new Client using the same
         * Client Code convention as client.service.js.
         */
        let clientId = resolvedClientId;

        let clientCode = null;


        /*
         * When an existing Client is reused, preserve its
         * Client Code in the activation result so that
         * downstream audit records identify the Client
         * accurately.
         */
        if (
            clientResolution ===
            'USE_EXISTING_CLIENT'
        ) {

            const matchingClient =
                existingClientRows.find(
                    client =>
                        Number(client.id) ===
                        Number(resolvedClientId)
                );


            if (!matchingClient) {

                throw new Error(
                    'The resolved existing Client could not be found.'
                );

            }


            clientCode =
                matchingClient.client_code;

        }


        if (clientResolution === 'CREATE_NEW_CLIENT') {

            /*
             * Generate a Client Code using the same convention
             * as client.service.js:
             *
             * CLT-<base36 timestamp><base36 random>
             *
             * The clients.client_code column is VARCHAR(20).
             */
            let clientCodeAttempts = 0;


            do {

                const timestamp =
                    Date.now()
                        .toString(36)
                        .toUpperCase();

                const random =
                    Math.random()
                        .toString(36)
                        .substring(2, 7)
                        .toUpperCase();

                clientCode =
                    `CLT-${timestamp}${random}`
                        .substring(0, 20);

                clientCodeAttempts++;


                const [existingCodeRows] =
                    await connection.execute(
                        `
                        SELECT
                            id
                        FROM clients
                        WHERE client_code = ?
                        LIMIT 1
                        `,
                        [clientCode]
                    );


                if (existingCodeRows.length === 0) {
                    break;
                }


                if (clientCodeAttempts >= 5) {

                    throw new Error(
                        'Unable to generate a unique Client Code.'
                    );

                }

            } while (true);


            /*
             * Determine the Client name to store.
             *
             * Normally the applicant name is used unchanged.
             *
             * Where a same-name Client already exists and staff
             * explicitly selected CREATE_NEW_CLIENT, the database
             * uniqueness rule on clients.name must still be
             * respected. The generated Client Code therefore
             * becomes the disambiguator for the new Client name.
             */
            const clientName =
                existingClientRows.length > 0
                    ? `${request.applicant_name} — ${clientCode}`
                    : request.applicant_name;


            const clientRemarks =
                existingClientRows.length > 0
                    ? `Created from Investigation Request ${request.request_reference}. Original applicant name: ${request.applicant_name}. Created as a new Client following explicit staff identity resolution despite an existing same-name Client.`
                    : `Created from Investigation Request ${request.request_reference}.`;


            /*
             * Create the Client.
             *
             * The applicant's address is preserved where
             * supplied. Investigation-specific subject
             * particulars remain attached to the original
             * Investigation Request.
             */
            const [clientResult] =
                await connection.execute(
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
                        request.client_type_id,
                        clientCode,
                        clientName,
                        null,
                        null,
                        null,
                        request.address_line_1 || null,
                        request.address_line_2 || null,
                        request.city || null,
                        request.state || null,
                        request.country || null,
                        request.postal_code || null,
                        clientRemarks
                    ]
                );


            clientId =
                clientResult.insertId;

        }


        /*
         * Resolve the active initial Case Status.
         *
         * The existing Case service uses the first active
         * non-terminal status as the initial status.
         */
        const [statusRows] =
            await connection.execute(
                `
                SELECT
                    id,
                    code
                FROM case_statuses
                WHERE is_active = 1
                  AND code NOT IN (
                      'CLOSED',
                      'CANCELLED'
                  )
                ORDER BY
                    display_order ASC,
                    id ASC
                LIMIT 1
                `,
            );


        if (statusRows.length === 0) {

            throw new Error(
                'No active initial Case Status is available.'
            );

        }


        const initialStatus =
            statusRows[0];


        /*
         * Resolve the active default Priority Level.
         */
        const [priorityRows] =
            await connection.execute(
                `
                SELECT
                    id
                FROM priority_levels
                WHERE is_active = 1
                ORDER BY
                    display_order ASC,
                    id ASC
                LIMIT 1
                `
            );


        if (priorityRows.length === 0) {

            throw new Error(
                'No active default Priority Level is available.'
            );

        }


        const priorityLevelId =
            priorityRows[0].id;


        /*
         * Generate a unique Case Reference using the same
         * general reference-generation convention used by
         * Case Management.
         *
         * Retry on the extremely unlikely collision.
         */
        let caseReference;
        let caseReferenceAttempts = 0;


        do {

            caseReference =
                `CASE-${crypto
                    .randomBytes(6)
                    .toString('hex')
                    .toUpperCase()}`;

            caseReferenceAttempts++;


            const [existingCaseRows] =
                await connection.execute(
                    `
                    SELECT
                        id
                    FROM cases
                    WHERE case_reference = ?
                    LIMIT 1
                    `,
                    [caseReference]
                );


            if (existingCaseRows.length === 0) {
                break;
            }


            if (caseReferenceAttempts >= 5) {

                throw new Error(
                    'Unable to generate a unique Case Reference.'
                );

            }

        } while (true);


        /*
         * Combine the original investigation purpose and
         * additional information into the Case summary.
         *
         * The original Investigation Request remains the
         * authoritative historical intake record.
         */
        let requestSummary =
            request.investigation_purpose || '';


        if (
            request.additional_information &&
            String(
                request.additional_information
            ).trim()
        ) {

            requestSummary +=
                `\n\nAdditional Information:\n${
                    request.additional_information
                }`;

        }


        /*
         * Create the Case.
         */
        const [caseResult] =
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
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `,
                [
                    caseReference,
                    clientId,
                    initialStatus.id,
                    priorityLevelId,
                    staffUserId,
                    null,
                    request.case_title,
                    requestSummary
                ]
            );


        const caseId =
            caseResult.insertId;


        /*
         * Retrieve all requested Investigation Services
         * from the original public request.
         */
        const [serviceRows] =
            await connection.execute(
                `
                SELECT
                    irs.investigation_type_id,
                    it.name AS service_name
                FROM investigation_request_services irs
                INNER JOIN investigation_types it
                    ON it.id = irs.investigation_type_id
                WHERE irs.investigation_request_id = ?
                ORDER BY
                    it.display_order ASC,
                    it.id ASC
                `,
                [request.id]
            );


        if (serviceRows.length === 0) {

            throw new Error(
                'Investigation Request has no Investigation Services.'
            );

        }


        /*
         * Resolve the active default Service Status.
         */
        const [serviceStatusRows] =
            await connection.execute(
                `
                SELECT
                    id,
                    code
                FROM service_statuses
                WHERE is_active = 1
                  AND code NOT IN (
                      'COMPLETED',
                      'CANCELLED'
                  )
                ORDER BY
                    display_order ASC,
                    id ASC
                LIMIT 1
                `
            );


        if (serviceStatusRows.length === 0) {

            throw new Error(
                'No active default Investigation Service Status is available.'
            );

        }


        const defaultServiceStatus =
            serviceStatusRows[0];


        /*
         * Add each requested Investigation Service to
         * the newly-created Case.
         */
        let displayOrder = 1;


        for (const service of serviceRows) {

            /*
             * Confirm the Investigation Type remains active
             * before activating it on the Case.
             */
            const [typeRows] =
                await connection.execute(
                    `
                    SELECT
                        id,
                        name,
                        is_active
                    FROM investigation_types
                    WHERE id = ?
                    LIMIT 1
                    `,
                    [service.investigation_type_id]
                );


            if (typeRows.length === 0) {

                throw new Error(
                    'An Investigation Service referenced by the request no longer exists.'
                );

            }


            if (
                Number(typeRows[0].is_active) !== 1
            ) {

                throw new Error(
                    `Investigation Service "${typeRows[0].name}" is no longer active and cannot be added to the Case.`
                );

            }


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
                    service.investigation_type_id,
                    defaultServiceStatus.id,
                    staffUserId,
                    displayOrder
                ]
            );


            displayOrder++;

        }


        /*
         * Create the Client User Account after the Client,
         * Case, and Case Investigation Services have been
         * successfully created.
         *
         * Everything in this block uses the SAME database
         * transaction as the rest of activation.
         *
         * A Client that already has a linked user account
         * is reused and does not receive another account
         * or activation credential.
         */

        let clientUserAccountId = null;
        let clientUserId = null;
        let clientAccountActivationReference = null;
        let clientAccountActivationToken = null;
        let clientAccountActivationExpiresAt = null;
        let clientAccountNotificationRecords = [];


        const [existingClientUserRows] =
            await connection.execute(
                `
                SELECT
                    cua.id AS client_user_account_id,
                    cua.user_id
                FROM client_user_accounts cua
                WHERE cua.client_id = ?
                ORDER BY
                    cua.id ASC
                LIMIT 1
                FOR UPDATE
                `,
                [clientId]
            );


        if (existingClientUserRows.length > 0) {

            /*
             * The Client already has an account.
             *
             * Reuse it. Do not generate another account
             * or activation link.
             */
            clientUserAccountId =
                Number(
                    existingClientUserRows[0]
                        .client_user_account_id
                );

            clientUserId =
                Number(
                    existingClientUserRows[0]
                        .user_id
                );

        } else {

            /*
             * Use the unique Client Code as the initial
             * username. The Client will choose the real
             * password through the activation link.
             */
            const clientUsername =
                String(clientCode || '')
                    .trim();


            if (!clientUsername) {

                throw new Error(
                    'A valid Client Code is required before creating the Client User Account.'
                );

            }


            /*
             * Split the applicant's existing name into the
             * user table's required first/last name fields.
             */
            const applicantNameParts =
                String(
                    request.applicant_name || ''
                )
                    .trim()
                    .split(/\s+/)
                    .filter(Boolean);


            if (applicantNameParts.length === 0) {

                throw new Error(
                    'A valid applicant name is required before creating the Client User Account.'
                );

            }


            const firstName =
                applicantNameParts[0];

            const lastName =
                applicantNameParts.length > 1
                    ? applicantNameParts
                        .slice(1)
                        .join(' ')
                    : applicantNameParts[0];


            /*
             * A cryptographically random internal password
             * satisfies the existing users.password_hash
             * requirement. It is never returned to the Client.
             */
            const temporaryPassword =
                generateClientTemporaryPassword();


            clientUserId =
                await userService
                    .createUserWithConnection(
                        connection,
                        {
                            firstName,
                            lastName,

                            username:
                                clientUsername,

                            email:
                                request.applicant_email
                                    ? String(
                                        request
                                            .applicant_email
                                    )
                                        .trim()
                                        .toLowerCase()
                                    : null,

                            phone:
                                String(
                                    request.applicant_phone
                                )
                                    .trim(),

                            roleId:
                                CLIENT_ROLE_ID,

                            password:
                                temporaryPassword,

                            createdBy:
                                null
                        }
                    );


            const [clientUserAccountResult] =
                await connection.execute(
                    `
                    INSERT INTO client_user_accounts (
                        client_id,
                        user_id
                    )
                    VALUES (?, ?)
                    `,
                    [
                        clientId,
                        clientUserId
                    ]
                );


            if (
                clientUserAccountResult.affectedRows !== 1
            ) {

                throw new Error(
                    'Client User Account could not be created.'
                );

            }


            clientUserAccountId =
                clientUserAccountResult.insertId;


            /*
             * Generate a one-time activation credential.
             * Only its SHA-256 hash is persisted.
             */
            clientAccountActivationToken =
                generateClientAccountActivationToken();


            const activationTokenHash =
                hashClientAccountActivationToken(
                    clientAccountActivationToken
                );


            clientAccountActivationReference =
                generateClientAccountActivationReference();


            const [
                clientAccountActivationResult
            ] = await connection.execute(
                `
                INSERT INTO client_account_activations (
                    client_user_account_id,
                    activation_reference,
                    token_hash,
                    expires_at
                )
                VALUES (
                    ?,
                    ?,
                    ?,
                    DATE_ADD(
                        CURRENT_TIMESTAMP,
                        INTERVAL ? HOUR
                    )
                )
                `,
                [
                    clientUserAccountId,
                    clientAccountActivationReference,
                    activationTokenHash,
                    CLIENT_ACCOUNT_ACTIVATION_EXPIRY_HOURS
                ]
            );


            if (
                clientAccountActivationResult
                    .affectedRows !== 1
            ) {

                throw new Error(
                    'Client account activation record could not be created.'
                );

            }


            const [
                clientAccountActivationRows
            ] = await connection.execute(
                `
                SELECT
                    expires_at
                FROM client_account_activations
                WHERE id = ?
                LIMIT 1
                `,
                [
                    clientAccountActivationResult
                        .insertId
                ]
            );


            if (
                clientAccountActivationRows.length !== 1
            ) {

                throw new Error(
                    'Client account activation expiry could not be retrieved.'
                );

            }


            clientAccountActivationExpiresAt =
                clientAccountActivationRows[0]
                    .expires_at;


            /*
             * Prepare notification records in this SAME
             * transaction. Actual delivery happens only
             * after the transaction has committed.
             */
            if (
                request.applicant_email &&
                String(
                    request.applicant_email
                ).trim()
            ) {

                const emailNotification =
                    await notificationService
                        .createNotificationWithConnection(
                            connection,
                            {
                                investigationRequestId:
                                    request.id,

                                eventType:
                                    'CLIENT_ACCOUNT_ACTIVATION_READY',

                                channel:
                                    'EMAIL',

                                recipient:
                                    String(
                                        request
                                            .applicant_email
                                    )
                                        .trim()
                                        .toLowerCase()
                            }
                        );


                clientAccountNotificationRecords
                    .push(
                        emailNotification
                    );

            }


            if (
                request.applicant_phone &&
                String(
                    request.applicant_phone
                ).trim()
            ) {

                const smsNotification =
                    await notificationService
                        .createNotificationWithConnection(
                            connection,
                            {
                                investigationRequestId:
                                    request.id,

                                eventType:
                                    'CLIENT_ACCOUNT_ACTIVATION_READY',

                                channel:
                                    'SMS',

                                recipient:
                                    String(
                                        request
                                            .applicant_phone
                                    ).trim()
                            }
                        );


                clientAccountNotificationRecords
                    .push(
                        smsNotification
                    );

            }


            if (
                clientAccountNotificationRecords.length ===
                0
            ) {

                throw new Error(
                    'Client account activation requires at least one valid notification recipient.'
                );

            }

        }


        /*
         * Mark the payment successful only after all
         * activation prerequisites have succeeded.
         *
         * This is deliberately part of the SAME transaction
         * as Client, Case, and Service creation.
         */

        /*
         * Link the original Investigation Request to the
         * newly-created Client and Case.
         */
        const [requestUpdate] =
            await connection.execute(
                `
                UPDATE investigation_requests
                SET
                    client_id = ?,
                    case_id = ?
                WHERE id = ?
                  AND status = 'ACCEPTED'
                  AND client_id IS NULL
                  AND case_id IS NULL
                `,
                [
                    clientId,
                    caseId,
                    request.id
                ]
            );


        if (requestUpdate.affectedRows !== 1) {

            throw new Error(
                'Investigation Request could not be linked to the activated Client and Case.'
            );

        }


        return {
            activated: true,
            alreadyActivated: false,
            requestId: request.id,
            requestReference:
                request.request_reference,
            clientId,
            clientCode,
            caseId,
            caseReference,
            paymentId:
                payment.id,
            paymentReference:
                payment.payment_reference,
            paymentAmount:
                Number(payment.amount || 0),
            paymentCurrency:
                payment.currency,
            paymentStatus:
                'SUCCESSFUL',

            clientUserAccountId:
                clientUserAccountId,

            clientUserId:
                clientUserId,

            clientAccountActivationReference:
                clientAccountActivationReference,

            clientAccountActivationToken:
                clientAccountActivationToken,

            clientAccountActivationExpiresAt:
                clientAccountActivationExpiresAt,

            clientAccountNotificationRecords:
                clientAccountNotificationRecords
        };


}


async function activateInvestigationRequest(
    requestId,
    staffUserId
) {

    const connection =
        await pool.getConnection();


    try {

        await connection.beginTransaction();


        const result =
            await _activateInvestigationRequestWithConnection(
                requestId,
                staffUserId,
                connection
            );


        await connection.commit();


        return result;


    } catch (error) {

        await connection.rollback();

        throw error;

    } finally {

        connection.release();

    }
}



module.exports = {
    getActiveClientTypes,
    getActiveInvestigationTypes,
    getActiveInvestigationTypeFields,
    createInvestigationRequest,
    getInvestigationRequests,
    getInvestigationRequestById,
    findClientByApplicantName,
    getPublicInvestigationRequestStatus,
    acceptInvestigationRequest,
    rejectInvestigationRequest,
    initializeInvestigationRequestPayment,
    confirmInvestigationRequestPayment,
    initiatePublicInvestigationRequestPayment,
    resolveInvestigationRequestClient,
    activateInvestigationRequest
};
