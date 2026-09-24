'use strict';

const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

const pool =
    require('../config/database');

const {
    generateStorageKey
} =
    require('../middleware/case-document-upload.middleware');


const STORAGE_DIRECTORY =
    path.resolve(
        process.cwd(),
        'storage',
        'case-documents'
    );


/**
 * Get all active Document Types.
 */
async function getDocumentTypes() {

    const [documentTypes] =
        await pool.execute(
            `
            SELECT
                id,
                name,
                description,
                display_order,
                is_active,
                requires_expiry_date
            FROM document_types
            WHERE is_active = 1
            ORDER BY
                display_order ASC,
                id ASC
            `
        );

    return documentTypes;
}


/**
 * Get all active Documents belonging to a Case.
 */
async function getDocumentsByCaseId(caseId) {

    const [documents] =
        await pool.execute(
            `
            SELECT
                cd.id,
                cd.case_id,
                cd.case_investigation_service_id,
                cd.document_type_id,
                cd.created_by,
                cd.original_filename,
                cd.mime_type,
                cd.file_size,
                cd.file_hash,
                cd.expiry_date,
                cd.is_private,
                cd.is_active,
                cd.created_at,
                cd.updated_at,

                dt.name AS document_type_name,
                dt.requires_expiry_date,

                u.username AS created_by_username,
                u.first_name AS created_by_first_name,
                u.middle_name AS created_by_middle_name,
                u.last_name AS created_by_last_name,

                it.name AS investigation_type_name,
                it.code AS investigation_type_code

            FROM case_documents cd

            INNER JOIN document_types dt
                ON dt.id = cd.document_type_id

            INNER JOIN users u
                ON u.id = cd.created_by

            LEFT JOIN case_investigation_services cis
                ON cis.id = cd.case_investigation_service_id

            LEFT JOIN investigation_types it
                ON it.id = cis.investigation_type_id

            WHERE cd.case_id = ?
              AND cd.is_active = 1

            ORDER BY
                cd.created_at DESC,
                cd.id DESC
            `,
            [caseId]
        );

    return documents;
}


/**
 * Get one active Case Document by ID.
 */
async function getDocumentById(documentId) {

    const [documents] =
        await pool.execute(
            `
            SELECT
                cd.id,
                cd.case_id,
                cd.case_investigation_service_id,
                cd.document_type_id,
                cd.created_by,
                cd.original_filename,
                cd.storage_key,
                cd.mime_type,
                cd.file_size,
                cd.file_hash,
                cd.expiry_date,
                cd.is_private,
                cd.is_active,
                cd.created_at,
                cd.updated_at,

                dt.name AS document_type_name,
                dt.description AS document_type_description,
                dt.requires_expiry_date,

                u.username AS created_by_username,
                u.first_name AS created_by_first_name,
                u.middle_name AS created_by_middle_name,
                u.last_name AS created_by_last_name,

                it.name AS investigation_type_name,
                it.code AS investigation_type_code

            FROM case_documents cd

            INNER JOIN document_types dt
                ON dt.id = cd.document_type_id

            INNER JOIN users u
                ON u.id = cd.created_by

            LEFT JOIN case_investigation_services cis
                ON cis.id = cd.case_investigation_service_id

            LEFT JOIN investigation_types it
                ON it.id = cis.investigation_type_id

            WHERE cd.id = ?
              AND cd.is_active = 1

            LIMIT 1
            `,
            [documentId]
        );

    if (documents.length === 0) {
        return null;
    }

    return documents[0];
}


/**
 * Get active investigation services belonging to a Case.
 */
async function getInvestigationServicesByCaseId(caseId) {

    const [services] =
        await pool.execute(
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
 * Get one Document Type.
 */
async function getDocumentTypeById(documentTypeId) {

    const [documentTypes] =
        await pool.execute(
            `
            SELECT
                id,
                name,
                description,
                display_order,
                is_active,
                requires_expiry_date
            FROM document_types
            WHERE id = ?
              AND is_active = 1
            LIMIT 1
            `,
            [documentTypeId]
        );

    if (documentTypes.length === 0) {
        return null;
    }

    return documentTypes[0];
}


/**
 * Confirm that an investigation service belongs
 * to a Case.
 */
async function investigationServiceBelongsToCase(
    caseId,
    serviceId
) {

    const [services] =
        await pool.execute(
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
 * Create a Case Document.
 *
 * The physical file is written first using a
 * generated storage key. If the database
 * operation fails, the physical file is removed.
 */
async function createDocument(
    caseId,
    createdBy,
    data,
    uploadedFile
) {

    if (!uploadedFile || !uploadedFile.buffer) {
        throw new Error('Document file is required.');
    }


    const connection =
        await pool.getConnection();


    let storageKey = null;
    let storagePath = null;


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
         * Confirm Document Type.
         */
        const [documentTypes] =
            await connection.execute(
                `
                SELECT
                    id,
                    requires_expiry_date
                FROM document_types
                WHERE id = ?
                  AND is_active = 1
                LIMIT 1
                `,
                [data.documentTypeId]
            );

        if (documentTypes.length === 0) {
            throw new Error('Document type is invalid.');
        }


        const documentType =
            documentTypes[0];


        /*
         * Validate expiry requirement.
         */
        if (
            documentType.requires_expiry_date &&
            !data.expiryDate
        ) {

            throw new Error(
                'An expiry date is required for this document type.'
            );
        }


        /*
         * If a service was supplied,
         * confirm that it belongs to the Case.
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
         * Generate a random storage key.
         */
        storageKey =
            generateStorageKey();


        storagePath =
            path.join(
                STORAGE_DIRECTORY,
                storageKey
            );


        /*
         * Calculate SHA-256 hash.
         */
        const fileHash =
            crypto
                .createHash('sha256')
                .update(uploadedFile.buffer)
                .digest('hex');


        /*
         * Ensure protected storage exists.
         */
        await fs.mkdir(
            STORAGE_DIRECTORY,
            {
                recursive: true,
                mode: 0o700
            }
        );


        /*
         * Write the physical file.
         */
        await fs.writeFile(
            storagePath,
            uploadedFile.buffer,
            {
                mode: 0o600
            }
        );


        /*
         * Create database record.
         */
        const [result] =
            await connection.execute(
                `
                INSERT INTO case_documents (
                    case_id,
                    case_investigation_service_id,
                    document_type_id,
                    created_by,
                    original_filename,
                    storage_key,
                    mime_type,
                    file_size,
                    file_hash,
                    expiry_date,
                    is_private,
                    is_active
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
                `,
                [
                    caseId,
                    data.caseInvestigationServiceId || null,
                    data.documentTypeId,
                    createdBy,
                    uploadedFile.originalname,
                    storageKey,
                    uploadedFile.mimetype,
                    uploadedFile.size,
                    fileHash,
                    data.expiryDate || null,
                    data.isPrivate ? 1 : 0
                ]
            );


        await connection.commit();


        return result.insertId;

    } catch (error) {

        await connection.rollback();


        /*
         * Remove the physical file if anything
         * failed after it was written.
         */
        if (storagePath) {

            try {

                await fs.unlink(storagePath);

            } catch (unlinkError) {

                if (unlinkError.code !== 'ENOENT') {

                    console.error(
                        'Failed to remove orphaned Case Document:',
                        unlinkError
                    );
                }
            }
        }


        throw error;

    } finally {

        connection.release();

    }
}


/**
 * Resolve the physical storage path for a document.
 */
function getStoragePath(storageKey) {

    if (
        !storageKey ||
        storageKey.includes('/') ||
        storageKey.includes('\\') ||
        storageKey.includes('..')
    ) {

        throw new Error(
            'Invalid document storage key.'
        );
    }


    return path.join(
        STORAGE_DIRECTORY,
        storageKey
    );
}


/**
 * Read a stored document from protected storage.
 */
async function readDocumentFile(storageKey) {

    const storagePath =
        getStoragePath(storageKey);

    return fs.readFile(storagePath);
}


/**
 * Update Case Document metadata.
 *
 * The physical file itself is not replaced.
 */
async function updateDocument(
    documentId,
    data
) {

    const connection =
        await pool.getConnection();

    try {

        await connection.beginTransaction();


        const [documents] =
            await connection.execute(
                `
                SELECT
                    id,
                    case_id
                FROM case_documents
                WHERE id = ?
                  AND is_active = 1
                LIMIT 1
                `,
                [documentId]
            );


        if (documents.length === 0) {

            throw new Error(
                'Case document not found.'
            );
        }


        const caseId =
            documents[0].case_id;


        /*
         * Confirm Document Type.
         */
        const [documentTypes] =
            await connection.execute(
                `
                SELECT
                    id,
                    requires_expiry_date
                FROM document_types
                WHERE id = ?
                  AND is_active = 1
                LIMIT 1
                `,
                [data.documentTypeId]
            );


        if (documentTypes.length === 0) {

            throw new Error(
                'Document type is invalid.'
            );
        }


        const documentType =
            documentTypes[0];


        if (
            documentType.requires_expiry_date &&
            !data.expiryDate
        ) {

            throw new Error(
                'An expiry date is required for this document type.'
            );
        }


        /*
         * Validate optional investigation service.
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


        await connection.execute(
            `
            UPDATE case_documents
            SET
                case_investigation_service_id = ?,
                document_type_id = ?,
                expiry_date = ?,
                is_private = ?
            WHERE id = ?
            `,
            [
                data.caseInvestigationServiceId || null,
                data.documentTypeId,
                data.expiryDate || null,
                data.isPrivate ? 1 : 0,
                documentId
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
    getDocumentTypes,
    getDocumentsByCaseId,
    getDocumentById,
    getInvestigationServicesByCaseId,
    getDocumentTypeById,
    investigationServiceBelongsToCase,
    createDocument,
    updateDocument,
    getStoragePath,
    readDocumentFile
};
