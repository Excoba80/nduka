'use strict';

const express = require('express');

const requireAuth =
    require('../middleware/requireAuth');

const requirePermission =
    require('../middleware/requirePermission');

const {
    csrfSynchronisedProtection
} =
    require('../config/csrf');

const {
    uploadCaseDocument
} =
    require('../middleware/case-document-upload.middleware');

const caseDocumentController =
    require('../controllers/case-document.controller');


const router = express.Router();


/*
 * Case Document Management
 *
 * All Case Document routes require authentication
 * and the appropriate RBAC permission.
 */


/*
 * Case Document list.
 */
router.get(
    '/cases/:id/documents',
    requireAuth,
    requirePermission('view_case_document'),
    caseDocumentController.index
);


/*
 * Add Case Document form.
 */
router.get(
    '/cases/:id/documents/new',
    requireAuth,
    requirePermission('create_case_document'),
    caseDocumentController.createForm
);


/*
 * Upload Case Document.
 *
 * Multer processes the multipart file upload before
 * the controller performs Case/document validation.
 */
router.post(
    '/cases/:id/documents',
    requireAuth,
    requirePermission('create_case_document'),
    uploadCaseDocument.single('document'),
    csrfSynchronisedProtection,
    caseDocumentController.create
);


/*
 * Edit Case Document metadata form.
 */
router.get(
    '/cases/:id/documents/:documentId/edit',
    requireAuth,
    requirePermission('update_case_document'),
    caseDocumentController.editForm
);


/*
 * Update Case Document metadata.
 *
 * The physical file is not replaced.
 */
router.post(
    '/cases/:id/documents/:documentId',
    requireAuth,
    requirePermission('update_case_document'),
    csrfSynchronisedProtection,
    caseDocumentController.update
);


/*
 * Download Case Document.
 *
 * The physical storage location remains protected.
 */
router.get(
    '/cases/:id/documents/:documentId/download',
    requireAuth,
    requirePermission('view_case_document'),
    caseDocumentController.download
);


module.exports = router;
