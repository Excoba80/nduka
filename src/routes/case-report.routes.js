'use strict';

const express = require('express');

const router = express.Router();

const requireAuth =
    require('../middleware/requireAuth');

const requirePermission = require('../middleware/requirePermission');

const {
    csrfSynchronisedProtection
} = require('../config/csrf');

const caseReportController =
    require('../controllers/case-report.controller');


/**
 * GET /cases/:id/reports
 *
 * Display all Case Reports.
 */
router.get(
    '/cases/:id/reports',
    requireAuth,
    requirePermission('view_case_report'),
    caseReportController.index
);


/**
 * GET /cases/:id/reports/new
 *
 * Display the Create Case Report form.
 */
router.get(
    '/cases/:id/reports/new',
    requireAuth,
    requirePermission('create_case_report'),
    caseReportController.createForm
);


/**
 * POST /cases/:id/reports
 *
 * Create a Case Report.
 */
router.post(
    '/cases/:id/reports',
    requireAuth,
    requirePermission('create_case_report'),
    csrfSynchronisedProtection,
    caseReportController.create
);


/**
 * GET /cases/:id/reports/:reportId/edit
 *
 * Display the Edit Case Report form.
 */
router.get(
    '/cases/:id/reports/:reportId/edit',
    requireAuth,
    requirePermission('update_case_report'),
    caseReportController.editForm
);


/**
 * POST /cases/:id/reports/:reportId
 *
 * Update a Case Report.
 */
router.post(
    '/cases/:id/reports/:reportId',
    requireAuth,
    requirePermission('update_case_report'),
    csrfSynchronisedProtection,
    caseReportController.update
);


/**
 * POST /cases/:id/reports/:reportId/submit
 *
 * Submit a Draft or Rejected Case Report.
 */
router.post(
    '/cases/:id/reports/:reportId/submit',
    requireAuth,
    requirePermission('submit_case_report'),
    csrfSynchronisedProtection,
    caseReportController.submit
);


/**
 * POST /cases/:id/reports/:reportId/approve
 *
 * Approve a Submitted Case Report.
 */
router.post(
    '/cases/:id/reports/:reportId/approve',
    requireAuth,
    requirePermission('approve_case_report'),
    csrfSynchronisedProtection,
    caseReportController.approve
);


/**
 * POST /cases/:id/reports/:reportId/reject
 *
 * Reject a Submitted Case Report.
 */
router.post(
    '/cases/:id/reports/:reportId/reject',
    requireAuth,
    requirePermission('reject_case_report'),
    csrfSynchronisedProtection,
    caseReportController.reject
);


module.exports = router;
