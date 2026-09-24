
'use strict';

const express = require('express');

const requireAuth = require('../middleware/requireAuth');
const requirePermission = require('../middleware/requirePermission');

const { csrfSynchronisedProtection } =
    require('../config/csrf');

const clientController =
    require('../controllers/client.controller');


const router = express.Router();


/*
 * Client Management
 *
 * Client routes require authentication and
 * the appropriate RBAC permission.
 */


/*
 * Client list.
 */
router.get(
    '/clients',
    requireAuth,
    requirePermission('view_client'),
    clientController.index
);


/*
 * Create-client form.
 */
router.get(
    '/clients/new',
    requireAuth,
    requirePermission('create_client'),
    clientController.createForm
);


/*
 * Create client.
 */
router.post(
    '/clients',
    requireAuth,
    requirePermission('create_client'),
    csrfSynchronisedProtection,
    clientController.create
);


/*
 * Edit-client form.
 */
router.get(
    '/clients/:id/edit',
    requireAuth,
    requirePermission('update_client'),
    clientController.editForm
);


/*
 * Update client.
 */
router.post(
    '/clients/:id',
    requireAuth,
    requirePermission('update_client'),
    csrfSynchronisedProtection,
    clientController.update
);


/*
 * Client details.
 *
 * This route comes after the more specific
 * /clients/:id/edit route.
 */
router.get(
    '/clients/:id',
    requireAuth,
    requirePermission('view_client'),
    clientController.show
);


module.exports = router;
