'use strict';

const express = require('express');


const {
    publicInvestigationRequestRateLimiter,
    publicRequestStatusRateLimiter,
    publicPaymentIntentRateLimiter,
    publicInvestigationServiceFeedbackRateLimiter
} = require('../middleware/rate-limit.middleware');


const requireAuth =
    require('../middleware/requireAuth');

const requirePermission =
    require('../middleware/requirePermission');

const {
    csrfSynchronisedProtection
} = require('../config/csrf');

const investigationRequestController =
    require('../controllers/investigation-request.controller');


const router = express.Router();


/*
 * Internal Investigation Request Management.
 *
 * Authenticated staff can view submitted Investigation
 * Requests and review them.
 */


/*
 * Investigation Request list.
 */
router.get(
    '/investigation-requests',
    requireAuth,
    requirePermission('view_investigation_request'),
    investigationRequestController.listRequests
);


/*
 * Investigation Request detail.
 */
router.get(
    '/investigation-requests/:requestId',
    requireAuth,
    requirePermission('view_investigation_request'),
    investigationRequestController.viewRequest
);


/*
 * Accept Investigation Request.
 *
 * Acceptance records the staff review decision.
 *
 * The accepted request remains linked to its original
 * public submission and awaits payment before a Client
 * and Case are created for the actual investigation workflow.
 */
router.post(
    '/investigation-requests/:requestId/accept',
    requireAuth,
    requirePermission('review_investigation_request'),
    csrfSynchronisedProtection,
    investigationRequestController.acceptRequest
);


/*
 * Reject Investigation Request.
 *
 * Rejection records the staff review decision and
 * requires a rejection reason.
 *
 * The original public submission remains preserved.
 */
router.post(
    '/investigation-requests/:requestId/reject',
    requireAuth,
    requirePermission('review_investigation_request'),
    csrfSynchronisedProtection,
    investigationRequestController.rejectRequest
);


/*
 * Initialize Investigation Request Payment.
 *
 * This creates the internal NDUKA payment transaction.
 * It does not confirm or complete the payment.
 */
router.post(
    '/investigation-requests/:requestId/payment',
    requireAuth,
    requirePermission('review_investigation_request'),
    csrfSynchronisedProtection,
    investigationRequestController.initializePayment
);




/*
 * Confirm Investigation Request Payment.
 *
 * Staff manually confirms that the visitor's payment
 * has been independently verified.
 *
 * This changes the payment from INITIATED to SUCCESSFUL.
 * It does not create a Client or Case.
 */
router.post(
    '/investigation-requests/:requestId/payment/confirm',
    requireAuth,
    requirePermission('review_investigation_request'),
    csrfSynchronisedProtection,
    investigationRequestController.confirmPayment
);


/*
 * Resolve Investigation Request Client Identity.
 *
 * When the applicant name matches an existing Client,
 * staff must explicitly choose whether to reuse that
 * Client or create a new Client before activation.
 *
 * This route is intentionally staff-only because Client
 * identity resolution is an internal administrative decision.
 */
router.post(
    '/investigation-requests/:requestId/resolve-client',
    requireAuth,
    requirePermission('review_investigation_request'),
    csrfSynchronisedProtection,
    investigationRequestController.resolveClient
);





/*
 * Public Investigation Request.
 *
 * Visitors do not need an authenticated
 * NDUKA account to submit a request.
 */
router.get(
    '/start-investigation',
    investigationRequestController.newRequest
);


router.post(
    '/start-investigation',
    publicInvestigationRequestRateLimiter,
    csrfSynchronisedProtection,
    investigationRequestController.createRequest
);


/*
 * Public Investigation Service Feedback.
 *
 * Visitors can suggest an investigation service that
 * is not currently available in the public catalogue.
 *
 * This is feedback only. It does not create an
 * Investigation Request, Client, Case, or payment record.
 */
router.post(
    '/investigation-service-feedback',
    publicInvestigationServiceFeedbackRateLimiter,
    csrfSynchronisedProtection,
    investigationRequestController.submitServiceFeedback
);




/*
 * Public Investigation Request Status.
 *
 * Visitors can check the status of an Investigation
 * Request using the Request Reference provided after
 * submission.
 */
router.get(
    '/investigation-request-status',
    investigationRequestController.publicRequestStatus
);


router.post(
    '/investigation-request-status',
    publicRequestStatusRateLimiter,
    csrfSynchronisedProtection,
    investigationRequestController.checkPublicRequestStatus
);




/*
 * Public Investigation Request Payment Intent.
 *
 * Visitors can indicate that they wish to proceed
 * with payment for an accepted Investigation Request.
 *
 * This records payment intent only. It does not
 * process a payment gateway transaction.
 */
router.post(
    '/investigation-request-payment',
    publicPaymentIntentRateLimiter,
    csrfSynchronisedProtection,
    investigationRequestController.initiatePublicPayment
);

module.exports = router;