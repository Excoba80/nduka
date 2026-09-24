'use strict';

const express = require('express');

const requireAuth =
    require('../middleware/requireAuth');

const requirePermission =
    require('../middleware/requirePermission');

const {
    csrfSynchronisedProtection
} = require('../config/csrf');

const caseNoteController =
    require('../controllers/case-note.controller');


const router = express.Router();


/*
 * Case Note Management
 *
 * All Case Note routes require authentication,
 * the appropriate RBAC permission, and CSRF
 * protection for state-changing requests.
 */


/*
 * Case Note list.
 */
router.get(
    '/cases/:id/notes',
    requireAuth,
    requirePermission('view_case_note'),
    caseNoteController.index
);


/*
 * Add Case Note form.
 */
router.get(
    '/cases/:id/notes/new',
    requireAuth,
    requirePermission('create_case_note'),
    caseNoteController.createForm
);


/*
 * Create Case Note.
 */
router.post(
    '/cases/:id/notes',
    requireAuth,
    requirePermission('create_case_note'),
    csrfSynchronisedProtection,
    caseNoteController.create
);


/*
 * Edit Case Note form.
 */
router.get(
    '/cases/:id/notes/:noteId/edit',
    requireAuth,
    requirePermission('update_case_note'),
    caseNoteController.editForm
);


/*
 * Update Case Note.
 */
router.post(
    '/cases/:id/notes/:noteId',
    requireAuth,
    requirePermission('update_case_note'),
    csrfSynchronisedProtection,
    caseNoteController.update
);


module.exports = router;
