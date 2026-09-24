'use strict';

const caseDocumentService =
    require('../services/case-document.service');

const caseService =
    require('../services/case.service');

const auditService =
    require('../services/audit.service');


/**
 * Build a display name for the authenticated user.
 */
function getActorName(req) {

    const user =
        req.session?.user || {};

    const parts = [
        user.first_name,
        user.middle_name,
        user.last_name
    ].filter(Boolean);

    return parts.length > 0
        ? parts.join(' ')
        : user.username || 'User';
}


/**
 * GET /cases/:id/documents
 *
 * List Case Documents.
 */
async function index(req, res, next) {

    try {

        const caseId =
            Number(req.params.id);

        if (!Number.isInteger(caseId) || caseId <= 0) {
            return res.status(404).render('error', {
                title: 'Case Not Found',
                message: 'The requested Case could not be found.',
                error: {
                    status: 404
                }
            });
        }


        const caseRecord =
            await caseService.getCaseById(caseId, req.session.user);

        if (!caseRecord) {
            return res.status(404).render('error', {
                title: 'Case Not Found',
                message: 'The requested Case could not be found.',
                error: {
                    status: 404
                }
            });
        }


        const documents =
            await caseDocumentService
                .getDocumentsByCaseId(caseId);


        res.render(
            'cases/documents/index',
            {
                title: 'Case Documents',
                caseRecord,
                documents
            }
        );

    } catch (error) {

        next(error);

    }
}


/**
 * GET /cases/:id/documents/new
 *
 * Display document upload form.
 */
async function createForm(req, res, next) {

    try {

        const caseId =
            Number(req.params.id);

        const caseRecord =
            await caseService.getCaseById(caseId, req.session.user);

        if (!caseRecord) {
            return res.status(404).render('error', {
                title: 'Case Not Found',
                message: 'The requested Case could not be found.',
                error: {
                    status: 404
                }
            });
        }


        if (caseRecord.status_is_terminal) {
            return res.status(403).render('error', {
                title: 'Case Locked',
                message: 'Documents cannot be added to a terminal Case.',
                error: {
                    status: 403
                }
            });
        }


        const [
            documentTypes,
            investigationServices
        ] = await Promise.all([
            caseDocumentService.getDocumentTypes(),
            caseDocumentService
                .getInvestigationServicesByCaseId(caseId)
        ]);


        res.render(
            'cases/documents/new',
            {
                title: 'Add Case Document',
                caseRecord,
                documentTypes,
                investigationServices,
                error: null,
                formData: {}
            }
        );

    } catch (error) {

        next(error);

    }
}


/**
 * POST /cases/:id/documents
 *
 * Upload a new Case Document.
 */
async function create(req, res, next) {

    const caseId =
        Number(req.params.id);

    try {

        const caseRecord =
            await caseService.getCaseById(caseId, req.session.user);

        if (!caseRecord) {
            return res.status(404).render('error', {
                title: 'Case Not Found',
                message: 'The requested Case could not be found.',
                error: {
                    status: 404
                }
            });
        }


        if (caseRecord.status_is_terminal) {
            return res.status(403).render('error', {
                title: 'Case Locked',
                message: 'Documents cannot be added to a terminal Case.',
                error: {
                    status: 403
                }
            });
        }


        const formData = {
            caseInvestigationServiceId:
                req.body.case_investigation_service_id || '',
            documentTypeId:
                req.body.document_type_id || '',
            expiryDate:
                req.body.expiry_date || '',
            isPrivate:
                req.body.is_private === '1'
        };


        const documentId =
            await caseDocumentService.createDocument(
                caseId,
                req.session.user.id,
                formData,
                req.file
            );


        try {

            await auditService.log({
                actorUserId: req.session.user.id,
                action: 'CREATE_CASE_DOCUMENT',
                targetUserId: null,
                description:
                    `Created Case Document #${documentId} for Case #${caseId}.`,
                ipAddress: req.ip,
                userAgent: req.get('user-agent')
            });

        } catch (auditError) {

            console.error(
                'Failed to record CREATE_CASE_DOCUMENT audit:',
                auditError
            );

        }


        res.redirect(
            `/cases/${caseId}/documents`
        );

    } catch (error) {

        try {

            const [
                documentTypes,
                investigationServices
            ] = await Promise.all([
                caseDocumentService.getDocumentTypes(),
                caseDocumentService
                    .getInvestigationServicesByCaseId(caseId)
            ]);


            const caseRecord =
                await caseService.getCaseById(caseId, req.session.user);


            return res.status(400).render(
                'cases/documents/new',
                {
                    title: 'Add Case Document',
                    caseRecord,
                    documentTypes,
                    investigationServices,
                    error: error.message,
                    formData: {
                        caseInvestigationServiceId:
                            req.body?.case_investigation_service_id || '',
                        documentTypeId:
                            req.body?.document_type_id || '',
                        expiryDate:
                            req.body?.expiry_date || '',
                        isPrivate:
                            req.body?.is_private === '1'
                    }
                }
            );

        } catch (renderError) {

            next(renderError);

        }

    }
}


/**
 * GET /cases/:id/documents/:documentId/edit
 *
 * Edit document metadata.
 */
async function editForm(req, res, next) {

    try {

        const caseId =
            Number(req.params.id);

        const documentId =
            Number(req.params.documentId);


        const caseRecord =
            await caseService.getCaseById(caseId, req.session.user);

        if (!caseRecord) {
            return res.status(404).render('error', {
                title: 'Case Not Found',
                message: 'The requested Case could not be found.',
                error: {
                    status: 404
                }
            });
        }


        const document =
            await caseDocumentService
                .getDocumentById(documentId);


        if (
            !document ||
            Number(document.case_id) !== caseId
        ) {
            return res.status(404).render('error', {
                title: 'Document Not Found',
                message: 'The requested Case Document could not be found.',
                error: {
                    status: 404
                }
            });
        }


        if (caseRecord.status_is_terminal) {
            return res.status(403).render('error', {
                title: 'Case Locked',
                message: 'Documents in a terminal Case cannot be modified.',
                error: {
                    status: 403
                }
            });
        }


        const [
            documentTypes,
            investigationServices
        ] = await Promise.all([
            caseDocumentService.getDocumentTypes(),
            caseDocumentService
                .getInvestigationServicesByCaseId(caseId)
        ]);


        res.render(
            'cases/documents/edit',
            {
                title: 'Edit Case Document',
                caseRecord,
                document,
                documentTypes,
                investigationServices,
                error: null
            }
        );

    } catch (error) {

        next(error);

    }
}


/**
 * POST /cases/:id/documents/:documentId
 *
 * Update document metadata.
 */
async function update(req, res, next) {

    try {

        const caseId =
            Number(req.params.id);

        const documentId =
            Number(req.params.documentId);


        const caseRecord =
            await caseService.getCaseById(caseId, req.session.user);

        if (!caseRecord) {
            return res.status(404).render('error', {
                title: 'Case Not Found',
                message: 'The requested Case could not be found.',
                error: {
                    status: 404
                }
            });
        }


        if (caseRecord.status_is_terminal) {
            return res.status(403).render('error', {
                title: 'Case Locked',
                message: 'Documents in a terminal Case cannot be modified.',
                error: {
                    status: 403
                }
            });
        }


        const document =
            await caseDocumentService
                .getDocumentById(documentId);


        if (
            !document ||
            Number(document.case_id) !== caseId
        ) {
            return res.status(404).render('error', {
                title: 'Document Not Found',
                message: 'The requested Case Document could not be found.',
                error: {
                    status: 404
                }
            });
        }


        const data = {
            caseInvestigationServiceId:
                req.body.case_investigation_service_id || '',
            documentTypeId:
                req.body.document_type_id || '',
            expiryDate:
                req.body.expiry_date || '',
            isPrivate:
                req.body.is_private === '1'
        };


        await caseDocumentService.updateDocument(
            documentId,
            data
        );


        try {

            await auditService.log({
                actorUserId: req.session.user.id,
                action: 'UPDATE_CASE_DOCUMENT',
                targetUserId: null,
                description:
                    `Updated metadata for Case Document #${documentId} in Case #${caseId}.`,
                ipAddress: req.ip,
                userAgent: req.get('user-agent')
            });

        } catch (auditError) {

            console.error(
                'Failed to record UPDATE_CASE_DOCUMENT audit:',
                auditError
            );

        }


        res.redirect(
            `/cases/${caseId}/documents`
        );

    } catch (error) {

        next(error);

    }
}


/**
 * GET /cases/:id/documents/:documentId/download
 *
 * Download a protected Case Document.
 *
 * The physical storage path is never exposed
 * to the browser.
 */
async function download(req, res, next) {

    try {

        const caseId =
            Number(req.params.id);

        const documentId =
            Number(req.params.documentId);


        const document =
            await caseDocumentService
                .getDocumentById(documentId);


        if (
            !document ||
            Number(document.case_id) !== caseId
        ) {
            return res.status(404).render('error', {
                title: 'Document Not Found',
                message: 'The requested Case Document could not be found.',
                error: {
                    status: 404
                }
            });
        }


        const file =
            await caseDocumentService
                .readDocumentFile(
                    document.storage_key
                );


        res.setHeader(
            'Content-Type',
            document.mime_type
        );

        res.setHeader(
            'Content-Length',
            String(file.length)
        );

        res.setHeader(
            'Content-Disposition',
            `attachment; filename="${encodeURIComponent(document.original_filename)}"`
        );


        res.send(file);

    } catch (error) {

        if (error.code === 'ENOENT') {

            return res.status(404).render('error', {
                title: 'File Not Found',
                message: 'The stored Case Document file could not be found.',
                error: {
                    status: 404
                }
            });

        }

        next(error);

    }
}


module.exports = {
    index,
    createForm,
    create,
    editForm,
    update,
    download
};
