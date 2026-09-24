'use strict';

const crypto = require('crypto');

const pool =
    require('../config/database');

const auditService =
    require('./audit.service');

const emailService =
    require('./email.service');

const smsService =
    require('./sms.service');


/**
 * Supported notification channels.
 */
const CHANNELS = Object.freeze([
    'EMAIL',
    'SMS'
]);


/**
 * Supported notification statuses.
 */
const STATUSES = Object.freeze([
    'PENDING',
    'SENT',
    'FAILED'
]);

/**
 * Supported notification business events.
 *
 * These constants describe why a notification exists.
 * They do not perform delivery.
 */
const NOTIFICATION_EVENTS = Object.freeze([
    'REQUEST_ACCEPTED',
    'REQUEST_REJECTED',
    'PAYMENT_READY',
    'PAYMENT_SUCCESSFUL',
    'PAYMENT_FAILED',
    'PAYMENT_CANCELLED',
    'CLIENT_ACCOUNT_ACTIVATION_READY'
]);


/**
 * Generate a unique notification reference.
 *
 * Format:
 * NOT-XXXXXXXXXXXXXXXX
 *
 * @returns {string}
 */
function generateNotificationReference() {

    return `NOT-${crypto
        .randomBytes(8)
        .toString('hex')
        .toUpperCase()}`;
}


/**
 * Validate a notification channel.
 *
 * @param {string} channel
 * @returns {void}
 */
function validateChannel(channel) {

    if (!CHANNELS.includes(channel)) {

        throw new Error(
            'Invalid notification channel.'
        );
    }
}


/**
 * Validate a notification status.
 *
 * @param {string} status
 * @returns {void}
 */
function validateStatus(status) {

    if (!STATUSES.includes(status)) {

        throw new Error(
            'Invalid notification status.'
        );
    }
}


/**
 * Find an existing notification for a specific
 * Investigation Request, business event, and channel.
 *
 * This supports workflow-level idempotency so that
 * the same business event does not accidentally create
 * duplicate EMAIL or SMS notification records.
 *
 * @param {number} investigationRequestId
 * @param {string} eventType
 * @param {string} channel
 * @returns {Promise<Object|null>}
 */
async function findExistingNotification(
    investigationRequestId,
    eventType,
    channel
) {

    if (
        !Number.isInteger(
            Number(investigationRequestId)
        ) ||
        Number(investigationRequestId) <= 0
    ) {

        throw new Error(
            'A valid Investigation Request ID is required.'
        );
    }


    if (
        typeof eventType !== 'string' ||
        !eventType.trim()
    ) {

        throw new Error(
            'A notification event type is required.'
        );
    }


    validateChannel(channel);


    const [notifications] =
        await pool.execute(
            `
            SELECT
                id,
                investigation_request_id,
                notification_reference,
                event_type,
                channel,
                recipient,
                status,
                provider_name,
                provider_reference,
                attempt_count,
                attempted_at,
                sent_at,
                failed_at,
                failure_reason,
                created_at,
                updated_at
            FROM investigation_request_notifications
            WHERE
                investigation_request_id = ?
                AND event_type = ?
                AND channel = ?
            ORDER BY
                id DESC
            LIMIT 1
            `,
            [
                Number(investigationRequestId),
                eventType.trim(),
                channel
            ]
        );


    return notifications[0] || null;
}


/**
 * Determine whether a new notification record may be created
 * for a specific Investigation Request, business event, and
 * channel.
 *
 * Idempotency policy:
 *
 * - No existing notification: CREATE
 * - PENDING notification: DO NOT CREATE
 * - SENT notification: DO NOT CREATE
 * - FAILED notification: CREATE A NEW RECORD
 *
 * FAILED notifications remain in the database as delivery
 * history and do not permanently block a future attempt.
 *
 * @param {number} investigationRequestId
 * @param {string} eventType
 * @param {string} channel
 * @returns {Promise<boolean>}
 */
async function shouldCreateNotification(
    investigationRequestId,
    eventType,
    channel
) {

    const existingNotification =
        await findExistingNotification(
            investigationRequestId,
            eventType,
            channel
        );


    if (!existingNotification) {

        return true;
    }


    if (
        existingNotification.status === 'FAILED'
    ) {

        return true;
    }


    return false;
}


/**
 * Create a notification delivery record.
 *
 * This function does not send the notification.
 *
 * The record is initially created as PENDING so that a
 * future provider adapter can attempt delivery and then
 * transition the record to SENT or FAILED.
 *
 * @param {Object} data
 * @param {number} data.investigationRequestId
 * @param {string} data.eventType
 * @param {string} data.channel
 * @param {string} data.recipient
 * @returns {Promise<Object>}
 */
/**
 * Create a notification using an existing database connection.
 *
 * This helper deliberately does NOT begin, commit, rollback,
 * or release a transaction. The caller owns the transaction.
 *
 * @param {import('mysql2/promise').PoolConnection} connection
 * @param {Object} data
 * @returns {Promise<Object>}
 */
async function createNotificationWithConnection(
    connection,
    {
        investigationRequestId,
        eventType,
        channel,
        recipient
    }
) {

    if (
        !Number.isInteger(
            Number(investigationRequestId)
        ) ||
        Number(investigationRequestId) <= 0
    ) {

        throw new Error(
            'A valid Investigation Request ID is required.'
        );
    }

    if (
        typeof eventType !== 'string' ||
        !eventType.trim()
    ) {

        throw new Error(
            'A notification event type is required.'
        );
    }

    validateChannel(channel);

    if (
        typeof recipient !== 'string' ||
        !recipient.trim()
    ) {

        throw new Error(
            'A notification recipient is required.'
        );
    }

    const notificationReference =
        generateNotificationReference();

    const [result] =
        await connection.execute(
            `
            INSERT INTO investigation_request_notifications (
                investigation_request_id,
                notification_reference,
                event_type,
                channel,
                recipient,
                status
            )
            VALUES (?, ?, ?, ?, ?, 'PENDING')
            `,
            [
                Number(investigationRequestId),
                notificationReference,
                eventType.trim(),
                channel,
                recipient.trim()
            ]
        );

    return {
        id:
            result.insertId,

        investigationRequestId:
            Number(investigationRequestId),

        notificationReference,

        eventType:
            eventType.trim(),

        channel,

        recipient:
            recipient.trim(),

        status:
            'PENDING'
    };
}


/**
 * Create a notification using its own transaction.
 *
 * @param {Object} data
 * @returns {Promise<Object>}
 */
async function createNotification(data) {

    const connection =
        await pool.getConnection();

    try {

        await connection.beginTransaction();

        const notification =
            await createNotificationWithConnection(
                connection,
                data
            );

        await connection.commit();

        return notification;

    } catch (error) {

        await connection.rollback();

        throw error;

    } finally {

        connection.release();

    }
}


/**
 * Record that a notification delivery attempt
 * has started.
 *
 * This does not perform the actual delivery.
 *
 * @param {number} notificationId
 * @returns {Promise<Object>}
 */
async function markNotificationAttempt(
    notificationId
) {

    if (
        !Number.isInteger(
            Number(notificationId)
        ) ||
        Number(notificationId) <= 0
    ) {

        throw new Error(
            'A valid notification ID is required.'
        );
    }


    const [result] =
        await pool.execute(
            `
            UPDATE investigation_request_notifications
            SET
                attempt_count =
                    attempt_count + 1,
                attempted_at =
                    CURRENT_TIMESTAMP
            WHERE id = ?
            LIMIT 1
            `,
            [
                Number(notificationId)
            ]
        );


    if (result.affectedRows === 0) {

        throw new Error(
            'Notification does not exist.'
        );
    }


    return getNotificationById(
        notificationId
    );
}


/**
 * Mark a notification as successfully sent.
 *
 * @param {number} notificationId
 * @param {Object} data
 * @param {string|null} data.providerName
 * @param {string|null} data.providerReference
 * @returns {Promise<Object>}
 */
async function markNotificationSent(
    notificationId,
    {
        providerName = null,
        providerReference = null
    } = {}
) {

    if (
        !Number.isInteger(
            Number(notificationId)
        ) ||
        Number(notificationId) <= 0
    ) {

        throw new Error(
            'A valid notification ID is required.'
        );
    }


    const [result] =
        await pool.execute(
            `
            UPDATE investigation_request_notifications
            SET
                status = 'SENT',
                provider_name = ?,
                provider_reference = ?,
                sent_at = CURRENT_TIMESTAMP,
                failed_at = NULL,
                failure_reason = NULL
            WHERE id = ?
            LIMIT 1
            `,
            [
                providerName || null,
                providerReference || null,
                Number(notificationId)
            ]
        );


    if (result.affectedRows === 0) {

        throw new Error(
            'Notification does not exist.'
        );
    }


    return getNotificationById(
        notificationId
    );
}


/**
 * Mark a notification as failed.
 *
 * @param {number} notificationId
 * @param {Object} data
 * @param {string|null} data.providerName
 * @param {string|null} data.providerReference
 * @param {string} data.failureReason
 * @returns {Promise<Object>}
 */
async function markNotificationFailed(
    notificationId,
    {
        providerName = null,
        providerReference = null,
        failureReason
    } = {}
) {

    if (
        !Number.isInteger(
            Number(notificationId)
        ) ||
        Number(notificationId) <= 0
    ) {

        throw new Error(
            'A valid notification ID is required.'
        );
    }


    if (
        typeof failureReason !== 'string' ||
        !failureReason.trim()
    ) {

        throw new Error(
            'A notification failure reason is required.'
        );
    }


    const [result] =
        await pool.execute(
            `
            UPDATE investigation_request_notifications
            SET
                status = 'FAILED',
                provider_name = ?,
                provider_reference = ?,
                failed_at = CURRENT_TIMESTAMP,
                failure_reason = ?
            WHERE id = ?
            LIMIT 1
            `,
            [
                providerName || null,
                providerReference || null,
                failureReason
                    .trim()
                    .substring(0, 1000),
                Number(notificationId)
            ]
        );


    if (result.affectedRows === 0) {

        throw new Error(
            'Notification does not exist.'
        );
    }


    return getNotificationById(
        notificationId
    );
}


/**
 * Get a notification by ID.
 *
 * @param {number} notificationId
 * @returns {Promise<Object|null>}
 */
async function getNotificationById(
    notificationId
) {

    if (
        !Number.isInteger(
            Number(notificationId)
        ) ||
        Number(notificationId) <= 0
    ) {

        throw new Error(
            'A valid notification ID is required.'
        );
    }


    const [notifications] =
        await pool.execute(
            `
            SELECT
                id,
                investigation_request_id,
                notification_reference,
                event_type,
                channel,
                recipient,
                status,
                provider_name,
                provider_reference,
                attempt_count,
                attempted_at,
                sent_at,
                failed_at,
                failure_reason,
                created_at,
                updated_at
            FROM investigation_request_notifications
            WHERE id = ?
            LIMIT 1
            `,
            [
                Number(notificationId)
            ]
        );


    return notifications[0] || null;
}


/**
 * Get notifications belonging to an
 * Investigation Request.
 *
 * @param {number} investigationRequestId
 * @returns {Promise<Array>}
 */
async function getNotificationsForRequest(
    investigationRequestId
) {

    if (
        !Number.isInteger(
            Number(investigationRequestId)
        ) ||
        Number(investigationRequestId) <= 0
    ) {

        throw new Error(
            'A valid Investigation Request ID is required.'
        );
    }


    const [notifications] =
        await pool.execute(
            `
            SELECT
                id,
                investigation_request_id,
                notification_reference,
                event_type,
                channel,
                recipient,
                status,
                provider_name,
                provider_reference,
                attempt_count,
                attempted_at,
                sent_at,
                failed_at,
                failure_reason,
                created_at,
                updated_at
            FROM investigation_request_notifications
            WHERE investigation_request_id = ?
            ORDER BY
                created_at DESC,
                id DESC
            `,
            [
                Number(investigationRequestId)
            ]
        );


    return notifications;
}


/**
 * Record a notification audit event.
 *
 * Notification audit failures must not turn an
 * otherwise successful notification state change
 * into a failed business operation.
 *
 * @param {Object} data
 * @returns {Promise<void>}
 */
/**
 * Deliver an EMAIL notification.
 *
 * This function performs the actual email delivery using
 * the provider-neutral email service.
 *
 * Business wording is supplied by the caller.
 * This function only coordinates:
 *
 * PENDING -> attempt -> SENT
 * PENDING -> attempt -> FAILED
 *
 * SMS notifications are intentionally not handled here.
 *
 * @param {Object} data
 * @param {number} data.notificationId
 * @param {string} data.subject
 * @param {string} data.text
 * @param {string|null} data.html
 * @returns {Promise<Object>}
 */


/**
 * Get a notification reference from either the
 * application-shaped or raw database-shaped object.
 *
 * @param {Object} notification
 * @returns {string}
 */
function getNotificationReference(notification) {

    return (
        notification.notificationReference ||
        notification.notification_reference ||
        ''
    );
}


async function deliverEmailNotification({
    notificationId,
    subject,
    text,
    html = null
}) {

    if (
        !Number.isInteger(
            Number(notificationId)
        ) ||
        Number(notificationId) <= 0
    ) {

        throw new Error(
            'A valid notification ID is required.'
        );
    }


    const notification =
        await getNotificationById(
            notificationId
        );


    if (!notification) {

        throw new Error(
            'Notification does not exist.'
        );
    }


    if (
        notification.channel !== 'EMAIL'
    ) {

        throw new Error(
            'Only EMAIL notifications can be delivered by this function.'
        );
    }


    if (
        notification.status === 'SENT'
    ) {

        return {
            notification,
            sent: false,
            reused: true
        };
    }


    if (
        notification.status !== 'PENDING'
    ) {

       throw new Error(
    `Notification ${getNotificationReference(notification)} ` +
    `is ${notification.status.toLowerCase()} and cannot be delivered.`
);
    }


    await markNotificationAttempt(
        notification.id
    );


    try {

        const result =
            await emailService.sendEmail({
                to:
                    notification.recipient,

                subject,

                text,

                html
            });


        const updatedNotification =
            await markNotificationSent(
                notification.id,
                {
                    providerName:
                        'BREVO_SMTP',

                    providerReference:
                        result.messageId || null
                }
            );


        return {
            notification:
                updatedNotification,

            sent: true,

            reused: false,

            providerName:
                'BREVO_SMTP',

            providerReference:
                result.messageId || null
        };

    } catch (error) {

        const updatedNotification =
            await markNotificationFailed(
                notification.id,
                {
                    providerName:
                        'BREVO_SMTP',

                    failureReason:
                        error.message ||
                        'Email delivery failed.'
                }
            );


        throw Object.assign(
    new Error(
        `Email delivery failed for ` +
        `${getNotificationReference(notification)}: ` +
        `${error.message || 'Unknown error.'}`
    ),
    {
        notification:
            updatedNotification
    }
);
    }
}


/**
 * Deliver an SMS notification.
 *
 * This function performs the actual SMS delivery using
 * the provider-neutral SMS service.
 *
 * Business wording is supplied by the caller.
 * This function only coordinates:
 *
 * PENDING -> attempt -> SENT
 * PENDING -> attempt -> FAILED
 *
 * @param {Object} data
 * @param {number} data.notificationId
 * @param {string} data.message
 * @returns {Promise<Object>}
 */
async function deliverSmsNotification({
    notificationId,
    message
}) {

    if (
        !Number.isInteger(
            Number(notificationId)
        ) ||
        Number(notificationId) <= 0
    ) {

        throw new Error(
            'A valid notification ID is required.'
        );
    }


    const notification =
        await getNotificationById(
            notificationId
        );


    if (!notification) {

        throw new Error(
            'Notification does not exist.'
        );
    }


    if (
        notification.channel !== 'SMS'
    ) {

        throw new Error(
            'Only SMS notifications can be delivered by this function.'
        );
    }


    if (
        notification.status === 'SENT'
    ) {

        return {
            notification,
            sent: false,
            reused: true
        };
    }


    if (
        notification.status !== 'PENDING'
    ) {

        throw new Error(
            `Notification ${getNotificationReference(notification)} ` +
            `is ${notification.status.toLowerCase()} and cannot be delivered.`
        );
    }


    if (
        typeof message !== 'string' ||
        !message.trim()
    ) {

        throw new Error(
            'An SMS message is required.'
        );
    }


    await markNotificationAttempt(
        notification.id
    );


    try {

        const result =
            await smsService.sendSms({
                to:
                    notification.recipient,

                message
            });


        const updatedNotification =
            await markNotificationSent(
                notification.id,
                {
                    providerName:
                        result.providerName ||
                        'TERMII',

                    providerReference:
                        result.providerReference ||
                        result.messageId ||
                        null
                }
            );


        return {
            notification:
                updatedNotification,

            sent: true,

            reused: false,

            providerName:
                result.providerName ||
                'TERMII',

            providerReference:
                result.providerReference ||
                result.messageId ||
                null
        };

    } catch (error) {

        const updatedNotification =
            await markNotificationFailed(
                notification.id,
                {
                    providerName:
                        'TERMII',

                    failureReason:
                        error.message ||
                        'SMS delivery failed.'
                }
            );


        throw Object.assign(
            new Error(
                `SMS delivery failed for ` +
                `${getNotificationReference(notification)}: ` +
                `${error.message || 'Unknown error.'}`
            ),
            {
                notification:
                    updatedNotification
            }
        );
    }
}


async function auditNotificationEvent({
    action,
    notification,
    description,
    actorUserId = null,
    ipAddress = null,
    userAgent = null
}) {

    try {

        await auditService.log({
            actorUserId,

            action,

            targetUserId:
                null,

           description:
    description ||
    `Notification ${getNotificationReference(notification)} ${action}.`,

            ipAddress,

            userAgent
        });

    } catch (auditError) {

        console.error(
            `Failed to record ${action} audit:`,
            auditError
        );
    }
}


module.exports = {
    CHANNELS,
    STATUSES,
    NOTIFICATION_EVENTS,

    findExistingNotification,
    shouldCreateNotification,

    createNotification,
    createNotificationWithConnection,
    markNotificationAttempt,
    markNotificationSent,
    markNotificationFailed,

    getNotificationById,
    getNotificationsForRequest,

    auditNotificationEvent,
    deliverEmailNotification,
    deliverSmsNotification
};
