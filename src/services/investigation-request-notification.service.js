'use strict';


const notificationService =
    require('./notification.service');


/**
 * Format a payment amount for human-readable
 * Investigation Request notification messages.
 *
 * @param {number|string} amount
 * @param {string} currency
 * @returns {string}
 */
function formatPaymentAmount(
    amount,
    currency = 'NGN'
) {

    const numericAmount =
        Number(amount);


    if (
        !Number.isFinite(numericAmount)
    ) {

        throw new Error(
            'A valid payment amount is required.'
        );

    }


    const normalizedCurrency =
        String(currency || 'NGN')
            .trim()
            .toUpperCase();


    return new Intl.NumberFormat(
        'en-NG',
        {
            style:
                'currency',

            currency:
                normalizedCurrency,

            minimumFractionDigits:
                2,

            maximumFractionDigits:
                2
        }
    ).format(
        numericAmount
    );
}


/**
 * Keep variable SMS text within a predictable length.
 *
 * Fixed identifiers such as request references and payment
 * references are never truncated by this helper.
 *
 * @param {string} value
 * @param {number} maxLength
 * @returns {string}
 */
function truncateSmsText(
    value,
    maxLength
) {

    const normalizedValue =
        String(
            value || ''
        ).trim();

    if (
        !Number.isInteger(maxLength) ||
        maxLength <= 0
    ) {
        throw new Error(
            'A valid SMS maximum length is required.'
        );
    }

    if (
        normalizedValue.length <= maxLength
    ) {
        return normalizedValue;
    }

    if (maxLength <= 3) {
        return normalizedValue.slice(
            0,
            maxLength
        );
    }

    return (
        normalizedValue.slice(
            0,
            maxLength - 3
        ) +
        '...'
    );
}


/**
 * Build the PAYMENT_READY email.
 *
 * Business wording belongs here rather than in
 * the generic notification service.
 *
 * @param {Object} data
 * @param {string} data.requestReference
 * @param {string} data.paymentReference
 * @param {number|string} data.amount
 * @param {string} data.currency
 * @returns {Object}
 */
function buildPaymentReadyEmail({
    requestReference,
    paymentReference,
    amount,
    currency = 'NGN'
}) {

    const normalizedRequestReference =
        String(
            requestReference || ''
        ).trim();


    const normalizedPaymentReference =
        String(
            paymentReference || ''
        ).trim();


    if (!normalizedRequestReference) {

        throw new Error(
            'Investigation Request Reference is required.'
        );

    }


    if (!normalizedPaymentReference) {

        throw new Error(
            'Payment Reference is required.'
        );

    }


    const formattedAmount =
        formatPaymentAmount(
            amount,
            currency
        );


    const subject =
        'NDUKA — Payment is Ready';


    const text =
        `Your payment transaction has been prepared. ` +
        `You can now proceed with your payment.\n\n` +

        `Investigation Request Reference: ` +
        `${normalizedRequestReference}\n` +

        `Payment Reference: ` +
        `${normalizedPaymentReference}\n` +

        `Amount: ` +
        `${formattedAmount}\n\n` +

        `To proceed with your payment, please visit NDUKA ` +
        `and use your Investigation Request Reference ` +
        `to check your request status.\n\n` +

        `On the Check Status page, enter:\n\n` +

        `Investigation Request Reference: ` +
        `${normalizedRequestReference}\n\n` +

        `After checking your request status, follow the ` +
        `Proceed to Pay option to continue with your payment.\n\n` +

        `Please keep your Investigation Request Reference ` +
        `and Payment Reference for your records.`;


    return {
        subject,
        text
    };
}




/**
 * Build the REQUEST_ACCEPTED email.
 *
 * Acceptance does not mean that payment has been made
 * or that the Investigation Request has been activated.
 *
 * @param {Object} data
 * @param {string} data.requestReference
 * @returns {Object}
 */
function buildRequestAcceptedEmail({
    requestReference
}) {

    const normalizedRequestReference =
        String(
            requestReference || ''
        ).trim();

    if (!normalizedRequestReference) {
        throw new Error(
            'Investigation Request Reference is required.'
        );
    }

    const subject =
        'NDUKA — Investigation Request Accepted';

    const text =
        `Your Investigation Request has been accepted by NDUKA.\n\n` +
        `Investigation Request Reference: ` +
        `${normalizedRequestReference}\n\n` +
        `Your request has passed the initial review stage. ` +
        `The next step is for NDUKA to prepare the payment ` +
        `transaction for the requested Investigation Services.\n\n` +
        `Once payment is ready, you will be notified and can ` +
        `proceed with payment through the NDUKA Check Status page.\n\n` +
        `Please keep your Investigation Request Reference ` +
        `for your records.`;

    return {
        subject,
        text
    };
}


/**
 * Deliver a REQUEST_ACCEPTED email notification.
 *
 * @param {Object} data
 * @returns {Promise<Object>}
 */
async function deliverRequestAcceptedEmail({
    notificationId,
    requestReference,
    actorUserId = null,
    ipAddress = null,
    userAgent = null
}) {

    const email =
        buildRequestAcceptedEmail({
            requestReference
        });

    const delivered =
        await notificationService
            .deliverEmailNotification({
                notificationId,
                subject:
                    email.subject,
                text:
                    email.text
            });

    await notificationService
        .auditNotificationEvent({
            action:
                'DELIVER_INVESTIGATION_REQUEST_NOTIFICATION',

            notification:
                delivered.notification,

            description:
                `Delivered EMAIL REQUEST_ACCEPTED notification ${delivered.notification.notification_reference || delivered.notification.notificationReference} for Investigation Request ${String(requestReference).trim()}.`,

            actorUserId,

            ipAddress,

            userAgent
        });

    return delivered;
}


/**
 * Build the REQUEST_REJECTED email.
 *
 * The rejection reason is included so the visitor understands
 * why the Investigation Request was not approved.
 *
 * @param {Object} data
 * @param {string} data.requestReference
 * @param {string} data.rejectionReason
 * @returns {Object}
 */
function buildRequestRejectedEmail({
    requestReference,
    rejectionReason
}) {

    const normalizedRequestReference =
        String(
            requestReference || ''
        ).trim();

    const normalizedRejectionReason =
        String(
            rejectionReason || ''
        ).trim();

    if (!normalizedRequestReference) {
        throw new Error(
            'Investigation Request Reference is required.'
        );
    }

    if (!normalizedRejectionReason) {
        throw new Error(
            'Investigation Request rejection reason is required.'
        );
    }

    const subject =
        'NDUKA — Investigation Request Not Approved';

    const text =
        `Your Investigation Request was reviewed by NDUKA ` +
        `but was not approved.

` +

        `Investigation Request Reference: ` +
        `${normalizedRequestReference}

` +

        `Reason for rejection:
` +
        `${normalizedRejectionReason}

` +

        `If you require further clarification, please keep ` +
        `your Investigation Request Reference and contact NDUKA ` +
        `through the appropriate support channel.

` +

        `Please keep your Investigation Request Reference ` +
        `for your records.`;

    return {
        subject,
        text
    };
}


/**
 * Deliver a REQUEST_REJECTED email notification.
 *
 * @param {Object} data
 * @returns {Promise<Object>}
 */
async function deliverRequestRejectedEmail({
    notificationId,
    requestReference,
    rejectionReason,
    actorUserId = null,
    ipAddress = null,
    userAgent = null
}) {

    const email =
        buildRequestRejectedEmail({
            requestReference,
            rejectionReason
        });

    const delivered =
        await notificationService
            .deliverEmailNotification({
                notificationId,
                subject:
                    email.subject,
                text:
                    email.text
            });

    await notificationService
        .auditNotificationEvent({
            action:
                'DELIVER_INVESTIGATION_REQUEST_NOTIFICATION',

            notification:
                delivered.notification,

            description:
                `Delivered EMAIL REQUEST_REJECTED notification ${delivered.notification.notification_reference || delivered.notification.notificationReference} for Investigation Request ${String(requestReference).trim()}.`,

            actorUserId,

            ipAddress,

            userAgent
        });

    return delivered;
}


/**
 * Deliver a PAYMENT_READY email notification.
 *
 * Investigation Request-specific message construction
 * remains in this service.
 *
 * Generic notification persistence, delivery state,
 * provider reference and idempotency remain in
 * notification.service.js.
 *
 * @param {Object} data
 * @returns {Promise<Object>}
 */
async function deliverPaymentReadyEmail({
    notificationId,
    requestReference,
    paymentReference,
    amount,
    currency = 'NGN',
    actorUserId = null,
    ipAddress = null,
    userAgent = null
}) {

    const email =
        buildPaymentReadyEmail({
            requestReference,
            paymentReference,
            amount,
            currency
        });


    const delivered =
        await notificationService
            .deliverEmailNotification({
                notificationId,
                subject:
                    email.subject,

                text:
                    email.text
            });


    await notificationService
        .auditNotificationEvent({
            action:
                'DELIVER_INVESTIGATION_REQUEST_NOTIFICATION',

            notification:
                delivered.notification,

            description:
                `Delivered EMAIL PAYMENT_READY notification ${delivered.notification.notification_reference || delivered.notification.notificationReference} for Investigation Request ${String(requestReference).trim()}.`,

            actorUserId,

            ipAddress,

            userAgent
        });


    return delivered;
}


/**
 * Build the CLIENT_ACCOUNT_ACTIVATION_READY email.
 *
 * The activation token is supplied only for message construction.
 * It is never stored in the notification record.
 *
 * @param {Object} data
 * @param {string} data.requestReference
 * @param {string} data.activationReference
 * @param {string} data.activationUrl
 * @param {string} data.username
 * @returns {Object}
 */
function buildClientAccountActivationEmail({
    requestReference,
    activationReference,
    activationUrl,
    username
}) {

    const normalizedRequestReference =
        String(
            requestReference || ''
        ).trim();

    const normalizedActivationReference =
        String(
            activationReference || ''
        ).trim();

    const normalizedActivationUrl =
        String(
            activationUrl || ''
        ).trim();

    const normalizedUsername =
        String(
            username || ''
        ).trim();

    if (!normalizedRequestReference) {

        throw new Error(
            'Investigation Request Reference is required.'
        );

    }

    if (!normalizedActivationReference) {

        throw new Error(
            'Client account activation reference is required.'
        );

    }

    if (!normalizedActivationUrl) {

        throw new Error(
            'Client account activation URL is required.'
        );

    }

    if (!normalizedUsername) {

        throw new Error(
            'Client account username is required.'
        );

    }

    const subject =
        'NDUKA — Activate Your Client Account';

    const text =
        `Your NDUKA Client account is ready for activation.\n\n` +

        `Investigation Request Reference: ` +
        `${normalizedRequestReference}\n` +

        `Client Username: ` +
        `${normalizedUsername}\n` +

        `Activation Reference: ` +
        `${normalizedActivationReference}\n\n` +

        `Please use the secure link below to create your ` +
        `Client account password:\n\n` +

        `${normalizedActivationUrl}\n\n` +

        `This activation link is for your account setup and ` +
        `expires after 48 hours. It can only be used once.\n\n` +

        `After activation, sign in using your Client Username ` +
        `and the password you created.\n\n` +

        `Please keep your Investigation Request Reference ` +
        `for your records.`;

    return {
        subject,
        text
    };
}


/**
 * Deliver a CLIENT_ACCOUNT_ACTIVATION_READY email.
 *
 * @param {Object} data
 * @returns {Promise<Object>}
 */
async function deliverClientAccountActivationEmail({
    notificationId,
    requestReference,
    activationReference,
    activationUrl,
    username,
    actorUserId = null,
    ipAddress = null,
    userAgent = null
}) {

    const email =
        buildClientAccountActivationEmail({
            requestReference,
            activationReference,
            activationUrl,
            username
        });

    const delivered =
        await notificationService
            .deliverEmailNotification({
                notificationId,
                subject:
                    email.subject,
                text:
                    email.text
            });

    await notificationService
        .auditNotificationEvent({
            action:
                'DELIVER_INVESTIGATION_REQUEST_NOTIFICATION',

            notification:
                delivered.notification,

            description:
                `Delivered EMAIL CLIENT_ACCOUNT_ACTIVATION_READY notification ${delivered.notification.notification_reference || delivered.notification.notificationReference} for Investigation Request ${String(requestReference).trim()}.`,

            actorUserId,

            ipAddress,

            userAgent
        });

    return delivered;
}


/**
 * Build the CLIENT_ACCOUNT_ACTIVATION_READY SMS.
 *
 * @param {Object} data
 * @param {string} data.requestReference
 * @param {string} data.activationReference
 * @param {string} data.activationUrl
 * @returns {string}
 */
function buildClientAccountActivationSms({
    requestReference,
    activationReference,
    activationUrl
}) {

    const normalizedRequestReference =
        String(
            requestReference || ''
        ).trim();

    const normalizedActivationReference =
        String(
            activationReference || ''
        ).trim();

    const normalizedActivationUrl =
        String(
            activationUrl || ''
        ).trim();

    if (!normalizedRequestReference) {

        throw new Error(
            'Investigation Request Reference is required.'
        );

    }

    if (!normalizedActivationReference) {

        throw new Error(
            'Client account activation reference is required.'
        );

    }

    if (!normalizedActivationUrl) {

        throw new Error(
            'Client account activation URL is required.'
        );

    }

    return (
        `NDUKA: Your Client account is ready. ` +
        `Request ${normalizedRequestReference}. ` +
        `Activation Ref: ${normalizedActivationReference}. ` +
        `Use the activation link sent by NDUKA to create your password.`
    );
}


/**
 * Deliver a CLIENT_ACCOUNT_ACTIVATION_READY SMS.
 *
 * The activation URL remains in the message content but
 * is never persisted as part of the notification record.
 *
 * @param {Object} data
 * @returns {Promise<Object>}
 */
async function deliverClientAccountActivationSms({
    notificationId,
    requestReference,
    activationReference,
    activationUrl,
    actorUserId = null,
    ipAddress = null,
    userAgent = null
}) {

    const message =
        buildClientAccountActivationSms({
            requestReference,
            activationReference,
            activationUrl
        });

    const delivered =
        await notificationService
            .deliverSmsNotification({
                notificationId,
                message
            });

    await notificationService
        .auditNotificationEvent({
            action:
                'DELIVER_INVESTIGATION_REQUEST_NOTIFICATION',

            notification:
                delivered.notification,

            description:
                `Delivered SMS CLIENT_ACCOUNT_ACTIVATION_READY notification ${delivered.notification.notification_reference || delivered.notification.notificationReference} for Investigation Request ${String(requestReference).trim()}.`,

            actorUserId,

            ipAddress,

            userAgent
        });

    return delivered;
}


/**
 * Build the REQUEST_ACCEPTED SMS.
 *
 * SMS wording is intentionally concise while preserving
 * the essential visitor-facing information.
 *
 * @param {Object} data
 * @param {string} data.requestReference
 * @returns {Object}
 */
function buildRequestAcceptedSms({
    requestReference
}) {

    const normalizedRequestReference =
        String(
            requestReference || ''
        ).trim();

    if (!normalizedRequestReference) {
        throw new Error(
            'Investigation Request Reference is required.'
        );
    }

    const message =
        `NDUKA: Your Investigation Request ` +
        `${normalizedRequestReference} has been accepted. ` +
        `NDUKA will now prepare your payment transaction. ` +
        `You will be notified when payment is ready.`;

    return {
        message
    };
}


/**
 * Deliver a REQUEST_ACCEPTED SMS notification.
 *
 * @param {Object} data
 * @returns {Promise<Object>}
 */
async function deliverRequestAcceptedSms({
    notificationId,
    requestReference,
    actorUserId = null,
    ipAddress = null,
    userAgent = null
}) {

    const sms =
        buildRequestAcceptedSms({
            requestReference
        });

    const delivered =
        await notificationService
            .deliverSmsNotification({
                notificationId,
                message:
                    sms.message
            });

    await notificationService
        .auditNotificationEvent({
            action:
                'DELIVER_INVESTIGATION_REQUEST_NOTIFICATION',

            notification:
                delivered.notification,

            description:
                `Delivered SMS REQUEST_ACCEPTED notification ${delivered.notification.notification_reference || delivered.notification.notificationReference} for Investigation Request ${String(requestReference).trim()}.`,

            actorUserId,

            ipAddress,

            userAgent
        });

    return delivered;
}


/**
 * Build the REQUEST_REJECTED SMS.
 *
 * @param {Object} data
 * @param {string} data.requestReference
 * @param {string} data.rejectionReason
 * @returns {Object}
 */
function buildRequestRejectedSms({
    requestReference,
    rejectionReason
}) {

    const normalizedRequestReference =
        String(
            requestReference || ''
        ).trim();

    const normalizedRejectionReason =
        String(
            rejectionReason || ''
        ).trim();

    if (!normalizedRequestReference) {
        throw new Error(
            'Investigation Request Reference is required.'
        );
    }

    if (!normalizedRejectionReason) {
        throw new Error(
            'Investigation Request rejection reason is required.'
        );
    }

    const smsRejectionReason =
        truncateSmsText(
            normalizedRejectionReason,
            80
        );

    const message =
        `NDUKA: Your Investigation Request ` +
        `${normalizedRequestReference} was not approved. ` +
        `Reason: ${smsRejectionReason}`;

    return {
        message
    };
}


/**
 * Deliver a REQUEST_REJECTED SMS notification.
 *
 * @param {Object} data
 * @returns {Promise<Object>}
 */
async function deliverRequestRejectedSms({
    notificationId,
    requestReference,
    rejectionReason,
    actorUserId = null,
    ipAddress = null,
    userAgent = null
}) {

    const sms =
        buildRequestRejectedSms({
            requestReference,
            rejectionReason
        });

    const delivered =
        await notificationService
            .deliverSmsNotification({
                notificationId,
                message:
                    sms.message
            });

    await notificationService
        .auditNotificationEvent({
            action:
                'DELIVER_INVESTIGATION_REQUEST_NOTIFICATION',

            notification:
                delivered.notification,

            description:
                `Delivered SMS REQUEST_REJECTED notification ${delivered.notification.notification_reference || delivered.notification.notificationReference} for Investigation Request ${String(requestReference).trim()}.`,

            actorUserId,

            ipAddress,

            userAgent
        });

    return delivered;
}


/**
 * Build the PAYMENT_READY SMS.
 *
 * @param {Object} data
 * @param {string} data.requestReference
 * @param {string} data.paymentReference
 * @param {number|string} data.amount
 * @param {string} data.currency
 * @returns {Object}
 */
function buildPaymentReadySms({
    requestReference,
    paymentReference,
    amount,
    currency = 'NGN'
}) {

    const normalizedRequestReference =
        String(
            requestReference || ''
        ).trim();

    const normalizedPaymentReference =
        String(
            paymentReference || ''
        ).trim();

    if (!normalizedRequestReference) {
        throw new Error(
            'Investigation Request Reference is required.'
        );
    }

    if (!normalizedPaymentReference) {
        throw new Error(
            'Payment Reference is required.'
        );
    }

    const formattedAmount =
        formatPaymentAmount(
            amount,
            currency
        );

    const smsAmount =
        formattedAmount
            .replace('₦', 'NGN ');

    const message =
        `NDUKA: Payment is ready for ` +
        `Request ${normalizedRequestReference}. ` +
        `Payment Ref: ${normalizedPaymentReference}. ` +
        `Amount: ${smsAmount}. ` +
        `Visit NDUKA Check Status to proceed.`;

    return {
        message
    };
}


/**
 * Deliver a PAYMENT_READY SMS notification.
 *
 * @param {Object} data
 * @returns {Promise<Object>}
 */
async function deliverPaymentReadySms({
    notificationId,
    requestReference,
    paymentReference,
    amount,
    currency = 'NGN',
    actorUserId = null,
    ipAddress = null,
    userAgent = null
}) {

    const sms =
        buildPaymentReadySms({
            requestReference,
            paymentReference,
            amount,
            currency
        });

    const delivered =
        await notificationService
            .deliverSmsNotification({
                notificationId,
                message:
                    sms.message
            });

    await notificationService
        .auditNotificationEvent({
            action:
                'DELIVER_INVESTIGATION_REQUEST_NOTIFICATION',

            notification:
                delivered.notification,

            description:
                `Delivered SMS PAYMENT_READY notification ${delivered.notification.notification_reference || delivered.notification.notificationReference} for Investigation Request ${String(requestReference).trim()}.`,

            actorUserId,

            ipAddress,

            userAgent
        });

    return delivered;
}


module.exports = {
    formatPaymentAmount,

    buildPaymentReadyEmail,
    deliverPaymentReadyEmail,

    buildRequestAcceptedEmail,
    deliverRequestAcceptedEmail,

    buildRequestRejectedEmail,
    deliverRequestRejectedEmail,

    buildRequestAcceptedSms,
    deliverRequestAcceptedSms,

    buildRequestRejectedSms,
    deliverRequestRejectedSms,

    buildPaymentReadySms,
    deliverPaymentReadySms,

    buildClientAccountActivationEmail,
    deliverClientAccountActivationEmail,

    buildClientAccountActivationSms,
    deliverClientAccountActivationSms
};