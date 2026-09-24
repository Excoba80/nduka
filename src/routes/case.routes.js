'use strict';

const express = require('express');

const requireAuth =
    require('../middleware/requireAuth');

const requirePermission =
    require('../middleware/requirePermission');

const {
    csrfSynchronisedProtection
} = require('../config/csrf');

const caseController =
    require('../controllers/case.controller');


const router = express.Router();


/*
 * Case Management
 *
 * All Case routes require authentication and
 * the appropriate RBAC permission.
 */


/*
 * Case list.
 */
router.get(
    '/cases',
    requireAuth,
    requirePermission('view_case'),
    caseController.index
);


/*
 * Create-Case form.
 */
router.get(
    '/cases/new',
    requireAuth,
    requirePermission('create_case'),
    caseController.createForm
);


/*
 * Create Case.
 */
router.post(
    '/cases',
    requireAuth,
    requirePermission('create_case'),
    csrfSynchronisedProtection,
    caseController.create
);


/*
 * Add Investigation Service to Case.
 */
router.post(
    '/cases/:id/services',
    requireAuth,
    requirePermission('update_case'),
    csrfSynchronisedProtection,
    caseController.addService
);


/*
 * Assign Investigation Service to an investigator.
 */
router.post(
    '/cases/:id/services/:serviceId/assign',
    requireAuth,
    requirePermission('assign_case'),
    csrfSynchronisedProtection,
    caseController.assignService
);


/*
 * Change Investigation Service status.
 */
router.post(
    '/cases/:id/services/:serviceId/status',
    requireAuth,
    requirePermission('change_case_status'),
    csrfSynchronisedProtection,
    caseController.changeServiceStatus
);



/*
 * Edit-Case form.
 */
router.get(
    '/cases/:id/edit',
    requireAuth,
    requirePermission('update_case'),
    caseController.editForm
);


/*
 * Update basic Case information.
 */
router.post(
    '/cases/:id',
    requireAuth,
    requirePermission('update_case'),
    csrfSynchronisedProtection,
    caseController.update
);


/*
 * Assign Case to an investigator.
 */
router.post(
    '/cases/:id/assign',
    requireAuth,
    requirePermission('assign_case'),
    csrfSynchronisedProtection,
    caseController.assign
);


/*
 * Change Case status.
 */
router.post(
    '/cases/:id/status',
    requireAuth,
    requirePermission('change_case_status'),
    csrfSynchronisedProtection,
    caseController.changeStatus
);


/*
 * Change Case priority.
 */
router.post(
    '/cases/:id/priority',
    requireAuth,
    requirePermission('change_case_priority'),
    csrfSynchronisedProtection,
    caseController.changePriority
);


/*
 * Case details.
 *
 * This route comes after the more specific
 * /cases/:id/edit route.
 */
router.get(
    '/cases/:id',
    requireAuth,
    requirePermission('view_case'),
    caseController.show
);


module.exports = router;
