'use strict';

const express = require('express');

const router = express.Router();

const requireAuth = require('../middleware/requireAuth');
const requirePermission = require('../middleware/requirePermission');

const auditController = require('../controllers/audit.controller');


/*
 * Audit Log
 *
 * Requires authentication and the
 * view_audit_log permission.
 */
router.get(
    '/',
    requireAuth,
    requirePermission('view_audit_log'),
    auditController.index
);


/*
 * Audit Log Detail
 *
 * Requires authentication and the
 * view_audit_log permission.
 */
router.get(
    '/:id',
    requireAuth,
    requirePermission('view_audit_log'),
    auditController.show
);


module.exports = router;