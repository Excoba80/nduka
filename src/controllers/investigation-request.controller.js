'use strict';

const investigationRequestService =
    require('../services/investigation-request.service');

const investigationRecommendationService =
    require('../services/investigation-recommendation.service');

const auditService =
    require('../services/audit.service');

const notificationService =
    require('../services/notification.service');


    const investigationRequestNotificationService =
    require('../services/investigation-request-notification.service');


const emailService =
    require('../services/email.service');


/**
 * Public Investigation Request form.
 */
async function newRequest(req, res, next) {

    try {

        const [
            clientTypes,
            investigationTypes
        ] = await Promise.all([
            investigationRequestService
                .getActiveClientTypes(),

            investigationRequestService
                .getActiveInvestigationTypes()
        ]);


        const recommendationObjectives =
            investigationRecommendationService.getObjectives();

        return res.render(
            'public/investigation-requests/new',
            {
                title: 'Start an Investigation',
                clientTypes,
                investigationTypes,
                recommendationObjectives,
                formData: {},
                error: null,
                feedbackSuccess:
                    req.query.feedback === 'sent',
                feedbackError:
                    req.query.feedback === 'invalid'
            }
        );

    } catch (error) {

        next(error);

    }
}




/**
 * Public Investigation Request submission.
 */
async function createRequest(req, res, next) {

    const formData = {
        clientTypeId:
            req.body.client_type_id,

        applicantName:
            req.body.applicant_name,

        applicantPhone:
            req.body.applicant_phone,

        applicantEmail:
            req.body.applicant_email,

        addressLine1:
            req.body.address_line_1,

        addressLine2:
            req.body.address_line_2,

        city:
            req.body.city,

        state:
            req.body.state,

        country:
            req.body.country,

        postalCode:
            req.body.postal_code,


        subjectName:
            req.body.subject_name,

        subjectPhone:
            req.body.subject_phone,

        subjectEmail:
            req.body.subject_email,


        caseTitle:
            req.body.case_title,

        investigationPurpose:
            req.body.investigation_purpose,

        additionalInformation:
            req.body.additional_information,


        investigationTypeIds:
            Array.isArray(req.body.investigation_type_ids)
                ? req.body.investigation_type_ids
                : [req.body.investigation_type_ids],


        /*
         * Dynamic Investigation Service fields.
         *
         * Expected structure:
         *
         * service_fields[typeId][fieldId]
         */
        serviceFields:
            req.body.service_fields || {},


        consentConfirmed:
            req.body.consent_confirmed === '1'
    };


    try {

        const result =
            await investigationRequestService
                .createInvestigationRequest(
                    formData
                );


        await auditService.log({
            actorUserId: null,
            action: 'CREATE_INVESTIGATION_REQUEST',
            description:
                `Public Investigation Request ${result.requestReference} was submitted.`,
            ipAddress: req.ip,
            userAgent: req.get('user-agent')
        });


        return res.render(
            'public/investigation-requests/success',
            {
                title: 'Investigation Request Submitted',
                requestReference:
                    result.requestReference
            }
        );


    } catch (error) {

        /*
         * Log the failure without logging the submitted
         * request body, because the request contains
         * applicant and investigation-subject information.
         */
        console.error(
            'CREATE INVESTIGATION REQUEST ERROR:',
            error.message
        );


        try {

            const [
                clientTypes,
                investigationTypes
            ] = await Promise.all([
                investigationRequestService
                    .getActiveClientTypes(),

                investigationRequestService
                    .getActiveInvestigationTypes()
            ]);


            const recommendationObjectives =
                investigationRecommendationService.getObjectives();

            return res.status(400).render(
                'public/investigation-requests/new',
                {
                    title: 'Start an Investigation',
                    clientTypes,
                    investigationTypes,
                    recommendationObjectives,
                    formData,
                    error: error.message
                }
            );


        } catch (renderError) {

            next(renderError);

        }

    }
}





/**
 * Public Investigation Service Feedback.
 *
 * This allows visitors to suggest an investigation service
 * that is not currently available in the public catalogue.
 *
 * Feedback is emailed to NDUKA for review. It does not
 * create an Investigation Request, Client, Case, or payment.
 */
async function submitServiceFeedback(req, res, next) {

    try {

        const name =
            String(req.body.name || '')
                .trim();

        const email =
            String(req.body.email || '')
                .trim()
                .replace(/[\r\n]/g, '');

        const subject =
            String(req.body.subject || '')
                .trim()
                .replace(/[\r\n]/g, '');

        const message =
            String(req.body.message || '')
                .trim();

        if (!name || !email || !subject || !message) {

            return res.redirect(
                '/start-investigation?feedback=invalid'
            );

        }

        if (name.length > 255) {

            return res.redirect(
                '/start-investigation?feedback=invalid'
            );

        }

        if (email.length > 255 ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {

            return res.redirect(
                '/start-investigation?feedback=invalid'
            );

        }

        if (subject.length > 255 ||
            message.length > 5000) {

            return res.redirect(
                '/start-investigation?feedback=invalid'
            );

        }

        await emailService.sendEmail({

            to: 'ndukaverify@gmail.com',

            subject:
                `NDUKA — New Investigation Service Suggestion: ${subject}`,

            text:
                [
                    'NDUKA INVESTIGATION SERVICE SUGGESTION',
                    '',
                    `Name: ${name}`,
                    `Email: ${email}`,
                    `Subject: ${subject}`,
                    '',
                    'Requested Service Description:',
                    message
                ].join('\n')

        });

        return res.redirect(
            '/start-investigation?feedback=sent'
        );

    } catch (error) {

        return next(error);

    }
}



/**
 * List Investigation Requests for staff review.
 *
 * This is a read-only administrative view.
 */
async function listRequests(req, res, next) {

    try {

        const requests =
            await investigationRequestService
                .getInvestigationRequests();


        return res.render(
            'investigations/requests/index',
            {
                title: 'Investigation Requests',
                requests
            }
        );

    } catch (error) {

        next(error);

    }
}


/**
 * View one complete Investigation Request.
 *
 * This preserves and displays the original
 * public submission for staff review.
 */
async function viewRequest(req, res, next) {

    try {

        const request =
            await investigationRequestService
                .getInvestigationRequestById(
                    req.params.requestId
                );


        if (!request) {

            return res.status(404).render(
                'errors/404',
                {
                    title: 'Investigation Request Not Found'
                }
            );

        }


        const matchingClient =
            await investigationRequestService
                .findClientByApplicantName(
                    request.applicant_name
                );

        return res.render(
            'investigations/requests/view',
            {
                title:
                    `Investigation Request ${request.request_reference}`,
                request,
                matchingClient
            }
        );

    } catch (error) {

        next(error);

    }
}





/**
 * Accept an Investigation Request.
 *
 * Acceptance only changes the request workflow state.
 * It does NOT create a Client, Case or Investigation
 * Service at this stage.
 */
async function acceptRequest(req, res, next) {

    const requestId =
        Number(req.params.requestId);

    const reviewerId =
        req.session.user.id;

    try {

        if (
            !Number.isInteger(requestId) ||
            requestId <= 0
        ) {
            return res.status(400).render(
                'error',
                {
                    title: 'Invalid Investigation Request',
                    message:
                        'A valid Investigation Request is required.'
                }
            );
        }

        const result =
            await investigationRequestService
                .acceptInvestigationRequest(
                    requestId,
                    reviewerId
                );

        /*
         * Centralized audit logging.
         */
        try {

            await auditService.log({
                actorUserId:
                    reviewerId,

                action:
                    'ACCEPT_INVESTIGATION_REQUEST',

                targetUserId:
                    null,

                description:
                    `Investigation Request ${result.requestReference} was accepted.`,

                ipAddress:
                    req.ip,

                userAgent:
                    req.get('user-agent')
            });

        } catch (auditError) {

            /*
             * Acceptance already succeeded.
             * Audit failure must not make the
             * successful acceptance appear to fail.
             */
            console.error(
                'Failed to record ACCEPT_INVESTIGATION_REQUEST audit:',
                auditError
            );
        }

        /*
         * Prepare acceptance notifications.
         *
         * This creates PENDING notification records only.
         * No email or SMS provider is called here.
         *
         * Notification preparation must not undo a
         * successful Investigation Request acceptance.
         */
        try {

            const acceptedRequest =
                await investigationRequestService
                    .getInvestigationRequestById(
                        requestId
                    );

            if (!acceptedRequest) {

                throw new Error(
                    'Accepted Investigation Request could not be reloaded for notification preparation.'
                );

            }

            const notificationChannels = [];

            if (acceptedRequest.applicant_email) {

                notificationChannels.push({
                    channel:
                        'EMAIL',

                    recipient:
                        acceptedRequest.applicant_email
                });

            }

            if (acceptedRequest.applicant_phone) {

                notificationChannels.push({
                    channel:
                        'SMS',

                    recipient:
                        acceptedRequest.applicant_phone
                });

            }

            for (
                const notification
                of notificationChannels
            ) {

                const shouldCreate =
                    await notificationService
                        .shouldCreateNotification(
                            requestId,
                            'REQUEST_ACCEPTED',
                            notification.channel
                        );

                if (!shouldCreate) {
                    continue;
                }

                const createdNotification =
                    await notificationService
                        .createNotification({
                            investigationRequestId:
                                requestId,

                            eventType:
                                'REQUEST_ACCEPTED',

                            channel:
                                notification.channel,

                            recipient:
                                notification.recipient
                        });

                try {

                    await auditService.log({
                        actorUserId:
                            reviewerId,

                        action:
                            'PREPARE_INVESTIGATION_REQUEST_NOTIFICATION',

                        targetUserId:
                            null,

                        description:
                            `Prepared ${notification.channel} REQUEST_ACCEPTED notification ${createdNotification.notificationReference} for Investigation Request ${result.requestReference}.`,

                        ipAddress:
                            req.ip,

                        userAgent:
                            req.get('user-agent')
                    });

                } catch (notificationAuditError) {

                    console.error(
                        'Failed to record notification preparation audit:',
                        notificationAuditError
                    );
                }


                /*
                 * Email delivery is performed independently after
                 * notification preparation. A delivery failure must
                 * not undo an already successful acceptance.
                 *
                 * SMS remains pending until an SMS provider is
                 * configured.
                 */
                if (
                    notification.channel ===
                    'EMAIL'
                ) {

                    try {

                        await investigationRequestNotificationService
                            .deliverRequestAcceptedEmail({
                                notificationId:
                                    createdNotification.id,

                                requestReference:
                                    result.requestReference,

                                actorUserId:
                                    reviewerId,

                                ipAddress:
                                    req.ip,

                                userAgent:
                                    req.get('user-agent')
                            });

                    } catch (emailDeliveryError) {

                        console.error(
                            'Failed to deliver Investigation Request acceptance email:',
                            emailDeliveryError
                        );
                    }

                } else if (
                    notification.channel ===
                    'SMS'
                ) {

                    try {

                        await investigationRequestNotificationService
                            .deliverRequestAcceptedSms({
                                notificationId:
                                    createdNotification.id,

                                requestReference:
                                    result.requestReference,

                                actorUserId:
                                    reviewerId,

                                ipAddress:
                                    req.ip,

                                userAgent:
                                    req.get('user-agent')
                            });

                    } catch (smsDeliveryError) {

                        console.error(
                            'Failed to deliver Investigation Request acceptance SMS:',
                            smsDeliveryError
                        );
                    }
                }
            }

        } catch (notificationError) {

            /*
             * Acceptance already succeeded.
             * Notification preparation failure must not make
             * the acceptance appear to have failed.
             */
            console.error(
                'Failed to prepare Investigation Request acceptance notifications:',
                notificationError
            );
        }

        return res.redirect(
            `/investigation-requests/${requestId}`
        );

    } catch (error) {

        /*
         * Expected business errors are displayed
         * as a normal application error.
         */
        if (
            error.message ===
                'Investigation Request not found.' ||
            error.message.includes(
                'has already been accepted'
            ) ||
            error.message.includes(
                'has already been rejected'
            )
        ) {
            return res.status(400).render(
                'error',
                {
                    title:
                        'Unable to Accept Investigation Request',
                    message:
                        error.message
                }
            );
        }

        next(error);
    }
}



/**
 * Reject an Investigation Request.
 *
 * Rejection changes the request workflow state and records
 * the review reason. It does not create or link a Client,
 * Case or Investigation Service.
 */
async function rejectRequest(req, res, next) {

    const requestId =
        Number(req.params.requestId);

    const reviewerId =
        req.session.user.id;

    const rejectionReason =
        typeof req.body.rejection_reason === 'string'
            ? req.body.rejection_reason.trim()
            : '';


    try {

        if (
            !Number.isInteger(requestId) ||
            requestId <= 0
        ) {
            return res.status(400).render(
                'error',
                {
                    title:
                        'Invalid Investigation Request',

                    message:
                        'A valid Investigation Request is required.'
                }
            );
        }


        if (!rejectionReason) {

            return res.status(400).render(
                'error',
                {
                    title:
                        'Unable to Reject Investigation Request',

                    message:
                        'A rejection reason is required.'
                }
            );

        }


        if (rejectionReason.length > 2000) {

            return res.status(400).render(
                'error',
                {
                    title:
                        'Unable to Reject Investigation Request',

                    message:
                        'The rejection reason must not exceed 2000 characters.'
                }
            );

        }


        const result =
            await investigationRequestService
                .rejectInvestigationRequest(
                    requestId,
                    reviewerId,
                    rejectionReason
                );


        /*
         * Centralized audit logging.
         */
        try {

            await auditService.log({
                actorUserId:
                    reviewerId,

                action:
                    'REJECT_INVESTIGATION_REQUEST',

                targetUserId:
                    null,

                description:
                    `Investigation Request ${result.requestReference} was rejected.`,

                ipAddress:
                    req.ip,

                userAgent:
                    req.get('user-agent')
            });

        } catch (auditError) {

            /*
             * Rejection already succeeded.
             * Audit failure must not make the
             * successful rejection appear to fail.
             */
            console.error(
                'Failed to record REJECT_INVESTIGATION_REQUEST audit:',
                auditError
            );
        }


        /*
         * Prepare rejection notifications.
         *
         * This creates PENDING notification records only.
         * No email or SMS provider is called here.
         *
         * Notification preparation must not undo a
         * successful Investigation Request rejection.
         */
        try {

            const rejectedRequest =
                await investigationRequestService
                    .getInvestigationRequestById(
                        requestId
                    );


            if (!rejectedRequest) {

                throw new Error(
                    'Rejected Investigation Request could not be reloaded for notification preparation.'
                );

            }


            const notificationChannels = [];


            if (rejectedRequest.applicant_email) {

                notificationChannels.push({
                    channel:
                        'EMAIL',

                    recipient:
                        rejectedRequest.applicant_email
                });

            }


            if (rejectedRequest.applicant_phone) {

                notificationChannels.push({
                    channel:
                        'SMS',

                    recipient:
                        rejectedRequest.applicant_phone
                });

            }


            for (
                const notification
                of notificationChannels
            ) {

                const shouldCreate =
                    await notificationService
                        .shouldCreateNotification(
                            requestId,
                            'REQUEST_REJECTED',
                            notification.channel
                        );


                if (!shouldCreate) {
                    continue;
                }


                const createdNotification =
                    await notificationService
                        .createNotification({
                            investigationRequestId:
                                requestId,

                            eventType:
                                'REQUEST_REJECTED',

                            channel:
                                notification.channel,

                            recipient:
                                notification.recipient
                        });


                try {

                    await auditService.log({
                        actorUserId:
                            reviewerId,

                        action:
                            'PREPARE_INVESTIGATION_REQUEST_NOTIFICATION',

                        targetUserId:
                            null,

                        description:
                            `Prepared ${notification.channel} REQUEST_REJECTED notification ${createdNotification.notificationReference} for Investigation Request ${result.requestReference}.`,

                        ipAddress:
                            req.ip,

                        userAgent:
                            req.get('user-agent')
                    });

                } catch (notificationAuditError) {

                    console.error(
                        'Failed to record notification preparation audit:',
                        notificationAuditError
                    );

                }


                /*
                 * Deliver the rejection email immediately.
                 *
                 * Rejection has already succeeded and notification
                 * delivery failure must never undo that rejection.
                 */
                if (notification.channel === 'EMAIL') {

                    try {

                        await investigationRequestNotificationService
                            .deliverRequestRejectedEmail({
                                notificationId:
                                    createdNotification.id,

                                requestReference:
                                    result.requestReference,

                                rejectionReason:
                                    result.rejectionReason,

                                actorUserId:
                                    reviewerId,

                                ipAddress:
                                    req.ip,

                                userAgent:
                                    req.get('user-agent')
                            });

                    } catch (emailDeliveryError) {

                        console.error(
                            'Failed to deliver Investigation Request rejection email:',
                            emailDeliveryError
                        );

                    }

                } else if (
                    notification.channel ===
                    'SMS'
                ) {

                    try {

                        await investigationRequestNotificationService
                            .deliverRequestRejectedSms({
                                notificationId:
                                    createdNotification.id,

                                requestReference:
                                    result.requestReference,

                                rejectionReason:
                                    result.rejectionReason,

                                actorUserId:
                                    reviewerId,

                                ipAddress:
                                    req.ip,

                                userAgent:
                                    req.get('user-agent')
                            });

                    } catch (smsDeliveryError) {

                        console.error(
                            'Failed to deliver Investigation Request rejection SMS:',
                            smsDeliveryError
                        );

                    }

                }

            }

        } catch (notificationError) {

            /*
             * Rejection already succeeded.
             * Notification preparation failure must not make
             * the rejection appear to have failed.
             */
            console.error(
                'Failed to prepare Investigation Request rejection notifications:',
                notificationError
            );

        }


        return res.redirect(
            `/investigation-requests/${requestId}`
        );


    } catch (error) {

        /*
         * Expected business errors are displayed
         * as a normal application error.
         */
        if (
            error.message ===
                'Investigation Request not found.' ||

            error.message.includes(
                'has already been accepted'
            ) ||

            error.message.includes(
                'has already been rejected'
            ) ||

            error.message ===
                'A rejection reason is required.' ||

            error.message.includes(
                'rejection reason must not exceed 2000 characters'
            )
        ) {

            return res.status(400).render(
                'error',
                {
                    title:
                        'Unable to Reject Investigation Request',

                    message:
                        error.message
                }
            );

        }


        next(error);

    }

}



/**
 * Initialize payment for an accepted Investigation Request.
 *
 * This creates the internal NDUKA payment transaction only.
 * It does not process or confirm a gateway payment.
 */
async function initializePayment(req, res, next) {

    const requestId =
        Number(req.params.requestId);

    const staffUserId =
        req.session.user.id;


    if (
        !Number.isInteger(requestId) ||
        requestId <= 0
    ) {
        return res.status(400).render(
            'error',
            {
                title:
                    'Invalid Investigation Request',

                message:
                    'A valid Investigation Request is required.'
            }
        );
    }


    try {

        const payment =
            await investigationRequestService
                .initializeInvestigationRequestPayment(
                    requestId
                );


        if (payment.created === true) {

            try {

                await auditService.log({
                    actorUserId:
                        staffUserId,

                    action:
                        'INITIALIZE_INVESTIGATION_REQUEST_PAYMENT',

                    targetUserId:
                        null,

                    description:
                        `Payment ${payment.paymentReference} was initialized for Investigation Request ${payment.requestReference}.`,

                    ipAddress:
                        req.ip,

                    userAgent:
                        req.get('user-agent')
                });

            } catch (auditError) {

                console.error(
                    'Failed to record INITIALIZE_INVESTIGATION_REQUEST_PAYMENT audit:',
                    auditError
                );

            }

        }


        /*
         * Prepare payment-ready notifications.
         *
         * A PENDING payment means NDUKA has successfully
         * prepared the payment transaction for the visitor.
         *
         * This creates PENDING notification records only.
         * No email or SMS provider is called here.
         *
         * Notification preparation must not undo successful
         * payment preparation.
         */
        if (payment.status === 'PENDING') {

            try {

                const preparedRequest =
                    await investigationRequestService
                        .getInvestigationRequestById(
                            requestId
                        );

                if (!preparedRequest) {

                    throw new Error(
                        'Investigation Request could not be reloaded for payment-ready notification preparation.'
                    );

                }

                const notificationChannels = [];

                if (preparedRequest.applicant_email) {

                    notificationChannels.push({
                        channel:
                            'EMAIL',

                        recipient:
                            preparedRequest.applicant_email
                    });

                }

                if (preparedRequest.applicant_phone) {

                    notificationChannels.push({
                        channel:
                            'SMS',

                        recipient:
                            preparedRequest.applicant_phone
                    });

                }

                for (
                    const notification
                    of notificationChannels
                ) {

                    const shouldCreate =
                        await notificationService
                            .shouldCreateNotification(
                                requestId,
                                'PAYMENT_READY',
                                notification.channel
                            );

                    if (!shouldCreate) {
                        continue;
                    }

                    const createdNotification =
                        await notificationService
                            .createNotification({
                                investigationRequestId:
                                    requestId,

                                eventType:
                                    'PAYMENT_READY',

                                channel:
                                    notification.channel,

                                recipient:
                                    notification.recipient
                            });

                    try {

                        await auditService.log({
                            actorUserId:
                                staffUserId,

                            action:
                                'PREPARE_INVESTIGATION_REQUEST_NOTIFICATION',

                            targetUserId:
                                null,

                            description:
                                `Prepared ${notification.channel} PAYMENT_READY notification ${createdNotification.notificationReference} for Investigation Request ${payment.requestReference}.`,

                            ipAddress:
                                req.ip,

                            userAgent:
                                req.get('user-agent')
                        });

                    } catch (notificationAuditError) {

                        console.error(
                            'Failed to record notification preparation audit:',
                            notificationAuditError
                        );

                    }


                    /*
                     * Deliver PAYMENT_READY email notifications
                     * immediately after they are prepared.
                     *
                     * Email delivery failure must not undo
                     * successful payment preparation.
                     *
                     * SMS remains pending until SMS delivery
                     * integration is implemented.
                     */
                    if (
                        notification.channel ===
                        'EMAIL'
                    ) {

                        try {

                            await investigationRequestNotificationService
                                .deliverPaymentReadyEmail({
                                    notificationId:
                                        createdNotification.id,

                                    requestReference:
                                        payment.requestReference,

                                    paymentReference:
                                        payment.paymentReference,

                                    amount:
                                        payment.amount,

                                    currency:
                                        payment.currency,

                                    actorUserId:
                                        staffUserId,

                                    ipAddress:
                                        req.ip,

                                    userAgent:
                                        req.get('user-agent')
                                });

                        } catch (emailDeliveryError) {

                            console.error(
                                'Failed to deliver Investigation Request PAYMENT_READY email:',
                                emailDeliveryError
                            );

                        }

                    } else if (
                        notification.channel ===
                        'SMS'
                    ) {

                        try {

                            await investigationRequestNotificationService
                                .deliverPaymentReadySms({
                                    notificationId:
                                        createdNotification.id,

                                    requestReference:
                                        payment.requestReference,

                                    paymentReference:
                                        payment.paymentReference,

                                    amount:
                                        payment.amount,

                                    currency:
                                        payment.currency,

                                    actorUserId:
                                        staffUserId,

                                    ipAddress:
                                        req.ip,

                                    userAgent:
                                        req.get('user-agent')
                                });

                        } catch (smsDeliveryError) {

                            console.error(
                                'Failed to deliver Investigation Request PAYMENT_READY SMS:',
                                smsDeliveryError
                            );

                        }

                    }

                }

            } catch (notificationError) {

                /*
                 * Payment preparation already succeeded.
                 * Notification preparation failure must not make
                 * the payment-ready state appear to have failed.
                 */
                console.error(
                    'Failed to prepare Investigation Request payment-ready notifications:',
                    notificationError
                );

            }

        }


        return res.redirect(
            `/investigation-requests/${requestId}`
        );


    } catch (error) {

        if (
            error.message ===
                'Investigation Request not found.' ||
            error.message.includes(
                'must be accepted before payment can be initialized'
            ) ||
            error.message.includes(
                'has no Investigation Services selected'
            ) ||
            error.message.includes(
                'Payment cannot be prepared because'
            )
        ) {

            return res.status(400).render(
                'error',
                {
                    title:
                        'Unable to Initialize Payment',

                    message:
                        error.message
                }
            );

        }


        next(error);

    }
}



/**
 * Confirm an Investigation Request payment manually
 * and activate the Investigation Request atomically.
 *
 * This is a staff-only operation.
 *
 * The payment must already be INITIATED by the public visitor.
 *
 * Payment confirmation, Client creation, Case creation,
 * Investigation Service creation, and Request linking are
 * performed by the service layer within one database
 * transaction.
 */
async function confirmPayment(req, res, next) {

    const requestId =
        Number(req.params.requestId);

    const staffUserId =
        req.session.user.id;


    if (
        !Number.isInteger(requestId) ||
        requestId <= 0
    ) {
        return res.status(400).render(
            'error',
            {
                title:
                    'Invalid Investigation Request',

                message:
                    'A valid Investigation Request is required.'
            }
        );
    }


    try {

        /*
         * Confirm the visitor's initiated payment and activate
         * the Investigation Request within one database
         * transaction.
         *
         * If activation fails, payment confirmation is rolled
         * back as well.
         */
        const activation =
            await investigationRequestService
                .confirmInvestigationRequestPayment(
                    requestId,
                    staffUserId
                );


        /*
         * Preserve the existing payment-confirmation
         * audit event.
         *
         * Audit logging occurs only after the business
         * transaction has successfully committed.
         */
        try {

            await auditService.log({
                actorUserId:
                    staffUserId,

                action:
                    'CONFIRM_INVESTIGATION_REQUEST_PAYMENT',

                targetUserId:
                    null,

                description:
                    `Payment ${activation.paymentReference} for Investigation Request ${activation.requestReference} was manually confirmed as successful and the request was activated.`,

                ipAddress:
                    req.ip,

                userAgent:
                    req.get('user-agent')
            });

        } catch (auditError) {

            /*
             * Business transaction already succeeded.
             * Audit failure must not make the successful
             * confirmation appear to fail.
             */
            console.error(
                'Failed to record CONFIRM_INVESTIGATION_REQUEST_PAYMENT audit:',
                auditError
            );

        }


        /*
         * Record the separate activation event.
         *
         * This is intentionally a separate audit record
         * so payment confirmation and investigation
         * activation remain distinguishable in the
         * audit trail.
         */
        if (activation.activated) {

            try {

                await auditService.log({
                    actorUserId:
                        staffUserId,

                    action:
                        'ACTIVATE_INVESTIGATION_REQUEST',

                    targetUserId:
                        null,

                    description:
                        `Investigation Request ${activation.requestReference} was activated after successful payment. Client ${activation.clientCode} and Case ${activation.caseReference} were created with the requested Investigation Services.`,

                    ipAddress:
                        req.ip,

                    userAgent:
                        req.get('user-agent')
                });

            } catch (auditError) {

                /*
                 * Activation already succeeded.
                 * Audit failure must not make the successful
                 * activation appear to fail.
                 */
                console.error(
                    'Failed to record ACTIVATE_INVESTIGATION_REQUEST audit:',
                    auditError
                );

            }

        }


        /*
         * Deliver the Client account activation notification
         * only AFTER the successful-payment transaction has
         * committed.
         *
         * The Client, Case, Case Investigation Services,
         * Client User Account, activation credential, and
         * notification records were created atomically.
         *
         * Provider delivery is intentionally outside that
         * transaction. A delivery failure must not undo the
         * completed business activation.
         */
        if (
            activation.activated &&
            activation.clientAccountActivationToken &&
            activation.clientAccountActivationReference &&
            Array.isArray(
                activation.clientAccountNotificationRecords
            ) &&
            activation.clientAccountNotificationRecords.length > 0
        ) {

            /*
             * NDUKA currently has no configured public application
             * URL, so the local request host is used for this
             * development workflow.
             */
            const activationUrl =
                `${req.protocol}://${req.get('host')}/activate?token=${
                    encodeURIComponent(
                        activation.clientAccountActivationToken
                    )
                }`;


            for (
                const notification
                of activation.clientAccountNotificationRecords
            ) {

                if (
                    notification.channel ===
                    'EMAIL'
                ) {

                    try {

                        await investigationRequestNotificationService
                            .deliverClientAccountActivationEmail({
                                notificationId:
                                    notification.id,

                                requestReference:
                                    activation.requestReference,

                                activationReference:
                                    activation.clientAccountActivationReference,

                                activationUrl,

                                username:
                                    activation.clientCode,

                                actorUserId:
                                    staffUserId,

                                ipAddress:
                                    req.ip,

                                userAgent:
                                    req.get('user-agent')
                            });

                    } catch (emailDeliveryError) {

                        console.error(
                            'Failed to deliver Client account activation email:',
                            emailDeliveryError
                        );

                    }

                } else if (
                    notification.channel ===
                    'SMS'
                ) {

                    try {

                        await investigationRequestNotificationService
                            .deliverClientAccountActivationSms({
                                notificationId:
                                    notification.id,

                                requestReference:
                                    activation.requestReference,

                                activationReference:
                                    activation.clientAccountActivationReference,

                                activationUrl,

                                actorUserId:
                                    staffUserId,

                                ipAddress:
                                    req.ip,

                                userAgent:
                                    req.get('user-agent')
                            });

                    } catch (smsDeliveryError) {

                        console.error(
                            'Failed to deliver Client account activation SMS:',
                            smsDeliveryError
                        );

                    }

                }

            }

        }


        return res.redirect(
            `/investigation-requests/${requestId}`
        );


    } catch (error) {

        /*
         * Expected business-state and activation errors
         * are shown as a controlled 400 response.
         */
        if (
            error.message ===
                'Investigation Request not found.' ||

            error.message.includes(
                'Only accepted Investigation Requests can be activated'
            ) ||

            error.message.includes(
                'No payment has been prepared'
            ) ||

            error.message.includes(
                'Only an initiated payment can be confirmed'
            ) ||

            error.message.includes(
                'Payment has already been confirmed'
            ) ||

            error.message.includes(
                'Investigation Request has already been activated'
            ) ||

            error.message.includes(
                'Client with the applicant name already exists'
            ) ||

            error.message.includes(
                'requires staff resolution'
            ) ||

            error.message.includes(
                'invalid Client Type'
            ) ||

            error.message.includes(
                'no Investigation Services'
            ) ||

            error.message.includes(
                'Investigation Service'
            ) ||

            error.message.includes(
                'No active initial Case Status'
            ) ||

            error.message.includes(
                'No active default Priority Level'
            ) ||

            error.message.includes(
                'could not be confirmed'
            ) ||

            error.message.includes(
                'could not be linked'
            )
        ) {

            return res.status(400).render(
                'error',
                {
                    title:
                        'Unable to Confirm Payment',

                    message:
                        error.message
                }
            );

        }


        next(error);

    }

}





/**
 * Record a public visitor's intent to proceed with payment.
 *
 * This does not process a payment gateway transaction.
 * It records the visitor's active payment intent by
 * transitioning a prepared payment from PENDING to INITIATED.
 */
async function initiatePublicPayment(
    req,
    res,
    next
) {

    const requestReference =
        String(
            req.body.request_reference || ''
        )
            .trim()
            .toUpperCase();


    try {

        const payment =
            await investigationRequestService
                .initiatePublicInvestigationRequestPayment(
                    requestReference
                );


        /*
         * The visitor is unauthenticated, so no internal
         * actor user ID is available.
         *
         * The payment reference and request reference provide
         * the auditable business identifiers.
         */
        try {

            await auditService.log({
                actorUserId:
                    null,

                action:
                    'INITIATE_PUBLIC_INVESTIGATION_REQUEST_PAYMENT',

                targetUserId:
                    null,

                description:
                    `Public payment intent was recorded for Investigation Request ${payment.requestReference} using Payment ${payment.paymentReference}.`,

                ipAddress:
                    req.ip,

                userAgent:
                    req.get('user-agent')
            });

        } catch (auditError) {

            console.error(
                'Failed to record public payment intent audit:',
                auditError
            );

        }


        return res.render(
            'public/investigation-requests/payment-initiated',
            {
                title:
                    'Payment Initiated',

                payment
            }
        );


    } catch (error) {

        /*
         * Public-safe errors only. Internal database or
         * implementation details must not be exposed.
         */
        if (
            error.message ===
                'Investigation Request not found.' ||

            error.message.includes(
                'A valid Investigation Request Reference'
            ) ||

            error.message.includes(
                'not ready for payment'
            ) ||

            error.message.includes(
                'No payment has been prepared yet'
            ) ||

            error.message.includes(
                'already been successful'
            ) ||

            error.message.includes(
                'cannot be initiated'
            )
        ) {

            return res.status(400).render(
                'public/investigation-requests/status',
                {
                    title:
                        'Investigation Request Status',

                    requestReference,

                    request:
                        null,

                    error:
                        error.message
                }
            );

        }


        next(error);

    }
}



/**
 * Display the public Investigation Request status form.
 *
 * Visitors can use their Investigation Request Reference
 * to check the current status of their request.
 */
async function publicRequestStatus(req, res, next) {

    try {

        return res.render(
            'public/investigation-requests/status',
            {
                title:
                    'Check Investigation Request Status',

                requestReference:
                    '',

                request:
                    null,

                error:
                    null
            }
        );

    } catch (error) {

        next(error);

    }
}



/**
 * Process a public Investigation Request status lookup.
 *
 * Only public-safe request status information is retrieved.
 * Confidential applicant, subject and investigation details
 * are never exposed through this endpoint.
 */
async function checkPublicRequestStatus(
    req,
    res,
    next
) {

    const requestReference =
        String(
            req.body.request_reference || ''
        )
            .trim()
            .toUpperCase();


    try {

        const request =
            await investigationRequestService
                .getPublicInvestigationRequestStatus(
                    requestReference
                );


        /*
         * Use a generic response for both invalid and
         * non-existent references.
         *
         * This avoids revealing unnecessary information
         * about which request references exist.
         */
        if (!request) {

            return res.status(404).render(
                'public/investigation-requests/status',
                {
                    title:
                        'Check Investigation Request Status',

                    requestReference,

                    request:
                        null,

                    error:
                        'We could not find an Investigation Request matching that reference.'
                }
            );

        }


        return res.render(
            'public/investigation-requests/status',
            {
                title:
                    'Investigation Request Status',

                requestReference,

                request,

                error:
                    null
            }
        );

    } catch (error) {

        next(error);

    }
}







/**
 * Resolve a Client identity collision for an accepted
 * Investigation Request and activate the request.
 *
 * The staff member must explicitly choose whether to
 * reuse the matching existing Client or create a new Client.
 *
 * The resolution and activation are performed together
 * inside the service-layer database transaction.
 */
async function resolveClient(req, res, next) {

    const requestId =
        Number(req.params.requestId);

    const staffUserId =
        req.session.user.id;

    const resolutionType =
        String(
            req.body.resolution || ''
        )
            .trim()
            .toUpperCase();


    if (
        !Number.isInteger(requestId) ||
        requestId <= 0
    ) {

        return res.status(400).render(
            'error',
            {
                title:
                    'Invalid Investigation Request',

                message:
                    'A valid Investigation Request is required.'
            }
        );

    }


    if (
        ![
            'USE_EXISTING_CLIENT',
            'CREATE_NEW_CLIENT'
        ].includes(resolutionType)
    ) {

        return res.status(400).render(
            'error',
            {
                title:
                    'Invalid Client Resolution',

                message:
                    'A valid Client identity-resolution choice is required.'
            }
        );

    }


    let clientId = null;


    if (
        resolutionType ===
        'USE_EXISTING_CLIENT'
    ) {

        clientId =
            Number(req.body.client_id);


        if (
            !Number.isInteger(clientId) ||
            clientId <= 0
        ) {

            return res.status(400).render(
                'error',
                {
                    title:
                        'Invalid Client Resolution',

                    message:
                        'A valid existing Client must be selected.'
                }
            );

        }

    }


    try {

        const resolution =
            await investigationRequestService
                .resolveInvestigationRequestClient(
                    requestId,
                    resolutionType,
                    clientId
                );


        /*
         * Record ONLY the staff identity-resolution decision.
         *
         * No Client or Case is created or linked here.
         * Actual activation remains the responsibility of
         * the final payment-confirmation workflow.
         */
        try {

            const description =
                resolutionType ===
                'USE_EXISTING_CLIENT'

                    ? `Investigation Request ${resolution.requestReference} identity was resolved to use existing Client ${resolution.matchingClientCode || clientId} during activation.`

                    : `Investigation Request ${resolution.requestReference} identity was resolved to create a new Client during activation.`;


            await auditService.log({
                actorUserId:
                    staffUserId,

                action:
                    'RESOLVE_INVESTIGATION_REQUEST_CLIENT',

                targetUserId:
                    null,

                description,

                ipAddress:
                    req.ip,

                userAgent:
                    req.get('user-agent')
            });

        } catch (auditError) {

            console.error(
                'Failed to record RESOLVE_INVESTIGATION_REQUEST_CLIENT audit:',
                auditError
            );

        }


        return res.redirect(
            `/investigation-requests/${requestId}`
        );


    } catch (error) {

        if (
            error.message ===
                'Investigation Request not found.' ||

            error.message.includes(
                'Only accepted Investigation Requests can have Client identity resolved'
            ) ||

            error.message.includes(
                'already been activated'
            ) ||

            error.message.includes(
                'already been resolved'
            ) ||

            error.message.includes(
                'valid existing Client'
            ) ||

            error.message.includes(
                'selected Client does not match'
            ) ||

            error.message.includes(
                'identity-resolution choice'
            ) ||

            error.message.includes(
                'could not be recorded'
            )
        ) {

            return res.status(400).render(
                'error',
                {
                    title:
                        'Unable to Resolve Client',

                    message:
                        error.message
                }
            );

        }


        next(error);

    }

}







module.exports = {
    newRequest,
    createRequest,
    submitServiceFeedback,
    listRequests,
    viewRequest,
    acceptRequest,
    rejectRequest,
    initializePayment,
    confirmPayment,
    resolveClient,
    initiatePublicPayment,
    publicRequestStatus,
    checkPublicRequestStatus
};