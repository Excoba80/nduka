'use strict';

const express = require('express');

const requireAuth =
    require('../middleware/requireAuth');

const requirePermission =
    require('../middleware/requirePermission');

const {
    csrfSynchronisedProtection
} = require('../config/csrf');

const investigationController =
    require('../controllers/investigation.controller');


const router = express.Router();


/*
 * Investigation Workspace
 *
 * The Investigation Workspace is the broader
 * investigation area of NDUKA.
 *
 * Investigation Services are managed within Cases.
 *
 * Access to the workspace requires view_case because
 * the workspace displays Case and Client information.
 */
router.get(
    '/investigations',
    requireAuth,
    requirePermission('view_case'),
    investigationController.index
);


/*
 * Investigation Type Management
 *
 * Investigation Types are configuration records
 * defining the investigation services available
 * within NDUKA.
 */


/*
 * Investigation Type list.
 */
router.get(
    '/investigations/types',
    requireAuth,
    requirePermission('view_investigation_type'),
    investigationController.indexTypes
);


/*
 * Create Investigation Type form.
 */
router.get(
    '/investigations/types/new',
    requireAuth,
    requirePermission('create_investigation_type'),
    investigationController.createTypeForm
);


/*
 * Create Investigation Type.
 */
router.post(
    '/investigations/types',
    requireAuth,
    requirePermission('create_investigation_type'),
    csrfSynchronisedProtection,
    investigationController.createType
);


/*
 * Edit Investigation Type form.
 */
router.get(
    '/investigations/types/:id/edit',
    requireAuth,
    requirePermission('update_investigation_type'),
    investigationController.editTypeForm
);


/*
 * Update Investigation Type.
 */
router.post(
    '/investigations/types/:id',
    requireAuth,
    requirePermission('update_investigation_type'),
    csrfSynchronisedProtection,
    investigationController.updateType
);


/*
 * Activate / Deactivate Investigation Type.
 */
router.post(
    '/investigations/types/:id/toggle',
    requireAuth,
    requirePermission('toggle_investigation_type'),
    csrfSynchronisedProtection,
    investigationController.toggleType
);


/*
 * Delete Investigation Type.
 *
 * The service layer must reject deletion when the
 * Investigation Type has already been used by an
 * Investigation Service.
 */
router.post(
    '/investigations/types/:id/delete',
    requireAuth,
    requirePermission('delete_investigation_type'),
    csrfSynchronisedProtection,
    investigationController.deleteType
);


/*
 * Investigation Type Fields.
 *
 * Manage the configurable fields belonging to an
 * Investigation Type.
 */

/*
 * List Investigation Type Fields.
 */
router.get(
    '/investigations/types/:id/fields',
    requireAuth,
    requirePermission('view_investigation_type_field'),
    investigationController.indexTypeFields
);


/*
 * Create Investigation Type Field form.
 */
router.get(
    '/investigations/types/:id/fields/new',
    requireAuth,
    requirePermission('create_investigation_type_field'),
    investigationController.createTypeFieldForm
);


/*
 * Create Investigation Type Field.
 */
router.post(
    '/investigations/types/:id/fields',
    requireAuth,
    requirePermission('create_investigation_type_field'),
    csrfSynchronisedProtection,
    investigationController.createTypeField
);


/*
 * Edit Investigation Type Field form.
 */
router.get(
    '/investigations/types/:id/fields/:fieldId/edit',
    requireAuth,
    requirePermission('update_investigation_type_field'),
    investigationController.editTypeFieldForm
);


/*
 * Update Investigation Type Field.
 */
router.post(
    '/investigations/types/:id/fields/:fieldId',
    requireAuth,
    requirePermission('update_investigation_type_field'),
    csrfSynchronisedProtection,
    investigationController.updateTypeField
);


/*
 * Activate / Deactivate Investigation Type Field.
 */
router.post(
    '/investigations/types/:id/fields/:fieldId/toggle',
    requireAuth,
    requirePermission('toggle_investigation_type_field'),
    csrfSynchronisedProtection,
    investigationController.toggleTypeField
);


/*
 * Delete Investigation Type Field.
 *
 * Deletion is intentionally controlled through the
 * update permission. The service layer prevents deletion
 * when historical request data depends on the field.
 */
router.post(
    '/investigations/types/:id/fields/:fieldId/delete',
    requireAuth,
    requirePermission('update_investigation_type_field'),
    csrfSynchronisedProtection,
    investigationController.deleteTypeField
);

module.exports = router;
