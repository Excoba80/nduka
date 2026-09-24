'use strict';

const express = require('express');

const requireAuth =
    require('../middleware/requireAuth');

const requirePermission =
    require('../middleware/requirePermission');

const {
    csrfSynchronisedProtection
} = require('../config/csrf');

const clientContactController =
    require('../controllers/client-contact.controller');


const router = express.Router();


/*
 * Client Contact Management
 *
 * All contact routes are scoped to a client.
 */


/*
 * Contact list.
 */
router.get(
    '/clients/:id/contacts',
    requireAuth,
    requirePermission('view_client_contact'),
    clientContactController.index
);


/*
 * Add-contact form.
 */
router.get(
    '/clients/:id/contacts/new',
    requireAuth,
    requirePermission('create_client_contact'),
    clientContactController.createForm
);


/*
 * Create contact.
 */
router.post(
    '/clients/:id/contacts',
    requireAuth,
    requirePermission('create_client_contact'),
    csrfSynchronisedProtection,
    clientContactController.create
);


/*
 * Edit-contact form.
 */
router.get(
    '/clients/:id/contacts/:contactId/edit',
    requireAuth,
    requirePermission('update_client_contact'),
    clientContactController.editForm
);


/*
 * Update contact.
 */
router.post(
    '/clients/:id/contacts/:contactId',
    requireAuth,
    requirePermission('update_client_contact'),
    csrfSynchronisedProtection,
    clientContactController.update
);


/*
 * Set primary contact.
 */
router.post(
    '/clients/:id/contacts/:contactId/primary',
    requireAuth,
    requirePermission('update_client_contact'),
    csrfSynchronisedProtection,
    clientContactController.setPrimary
);


/*
 * Activate / deactivate contact.
 */
router.post(
    '/clients/:id/contacts/:contactId/status',
    requireAuth,
    requirePermission('update_client_contact'),
    csrfSynchronisedProtection,
    clientContactController.setActiveStatus
);


module.exports = router;
