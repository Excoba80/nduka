'use strict';

const nodemailer =
    require('nodemailer');


/**
 * Read and validate the SMTP configuration.
 *
 * Credentials must come from environment variables.
 * No SMTP secret is stored in source code.
 *
 * @returns {Object}
 */
function getSmtpConfig() {

    const host =
        String(process.env.SMTP_HOST || '').trim();

    const port =
        Number(process.env.SMTP_PORT || 587);

    const secure =
        String(
            process.env.SMTP_SECURE || 'false'
        ).toLowerCase() === 'true';

    const user =
        String(process.env.SMTP_USER || '').trim();

    const password =
        String(process.env.SMTP_PASSWORD || '');

    const fromEmail =
        String(
            process.env.SMTP_FROM_EMAIL || ''
        ).trim();

    const fromName =
        String(
            process.env.SMTP_FROM_NAME || 'NDUKA'
        ).trim();


    if (!host) {

        throw new Error(
            'SMTP_HOST is not configured.'
        );
    }


    if (
        !Number.isInteger(port) ||
        port <= 0 ||
        port > 65535
    ) {

        throw new Error(
            'SMTP_PORT is invalid.'
        );
    }


    if (!user) {

        throw new Error(
            'SMTP_USER is not configured.'
        );
    }


    if (!password) {

        throw new Error(
            'SMTP_PASSWORD is not configured.'
        );
    }


    if (!fromEmail) {

        throw new Error(
            'SMTP_FROM_EMAIL is not configured.'
        );
    }


    return {
        host,
        port,
        secure,
        auth: {
            user,
            pass: password
        },
        from: {
            name: fromName,
            address: fromEmail
        }
    };
}


/**
 * Create the NDUKA SMTP transport.
 *
 * A new transport is created only when delivery is
 * requested. The transport itself performs no delivery
 * until sendMail() is called.
 *
 * @returns {Object}
 */
function createTransport() {

    const config =
        getSmtpConfig();


    return {
        transporter:
            nodemailer.createTransport({
                host:
                    config.host,

                port:
                    config.port,

                secure:
                    config.secure,

                auth:
                    config.auth
            }),

        from:
            config.from
    };
}


/**
 * Verify SMTP connectivity and authentication.
 *
 * This performs an SMTP connection/authentication check
 * but does not send an email.
 *
 * @returns {Promise<Object>}
 */
async function verifyEmailTransport() {

    const {
        transporter
    } = createTransport();


    await transporter.verify();


    return {
        verified: true
    };
}


/**
 * Send an email.
 *
 * This function contains no NDUKA business wording.
 * The caller supplies the recipient, subject and body.
 *
 * @param {Object} data
 * @param {string} data.to
 * @param {string} data.subject
 * @param {string} data.text
 * @param {string|null} data.html
 * @returns {Promise<Object>}
 */
async function sendEmail({
    to,
    subject,
    text,
    html = null
}) {

    if (
        typeof to !== 'string' ||
        !to.trim()
    ) {

        throw new Error(
            'A valid email recipient is required.'
        );
    }


    if (
        typeof subject !== 'string' ||
        !subject.trim()
    ) {

        throw new Error(
            'An email subject is required.'
        );
    }


    if (
        typeof text !== 'string' ||
        !text.trim()
    ) {

        throw new Error(
            'An email text body is required.'
        );
    }


    const {
        transporter,
        from
    } = createTransport();


    const message = {
        from,

        to:
            to.trim(),

        subject:
            subject.trim(),

        text:
            text.trim()
    };


    if (
        typeof html === 'string' &&
        html.trim()
    ) {

        message.html =
            html.trim();
    }


    const result =
        await transporter.sendMail(
            message
        );


    return {
        messageId:
            result.messageId,

        accepted:
            result.accepted,

        rejected:
            result.rejected,

        response:
            result.response || null
    };
}


module.exports = {
    getSmtpConfig,
    verifyEmailTransport,
    sendEmail
};
