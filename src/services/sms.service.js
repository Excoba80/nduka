'use strict';

const DEFAULT_TIMEOUT_MS = 15000;


/**
 * Read and validate the Termii configuration.
 *
 * Credentials must come from environment variables.
 * No Termii secret is stored in source code.
 *
 * @returns {Object}
 */
function getConfig() {

    const apiKey =
        String(
            process.env.TERMII_API_KEY || ''
        ).trim();

    const baseUrl =
        String(
            process.env.TERMII_BASE_URL || ''
        ).trim();

    const senderId =
        String(
            process.env.TERMII_SENDER_ID || ''
        ).trim();

    const channel =
        String(
            process.env.TERMII_CHANNEL || 'dnd'
        ).trim();


    if (!apiKey) {

        throw new Error(
            'TERMII_API_KEY is not configured.'
        );
    }


    if (!baseUrl) {

        throw new Error(
            'TERMII_BASE_URL is not configured.'
        );
    }


    if (!senderId) {

        throw new Error(
            'TERMII_SENDER_ID is not configured.'
        );
    }


    if (!channel) {

        throw new Error(
            'TERMII_CHANNEL is not configured.'
        );
    }


    return {
        apiKey,
        baseUrl:
            baseUrl.replace(/\/+$/, ''),
        senderId,
        channel
    };
}


/**
 * Normalize a Nigerian phone number into international format.
 *
 * Examples:
 * 08012345678  -> 2348012345678
 * +2348012345678 -> 2348012345678
 * 2348012345678 -> 2348012345678
 *
 * @param {string|number} phoneNumber
 * @returns {string}
 */
function normalizeNigeriaPhoneNumber(
    phoneNumber
) {

    if (
        phoneNumber === null ||
        phoneNumber === undefined
    ) {

        throw new Error(
            'SMS recipient phone number is required.'
        );
    }


    let value =
        String(phoneNumber).trim();


    if (!value) {

        throw new Error(
            'SMS recipient phone number is required.'
        );
    }


    value =
        value.replace(
            /[\s().-]/g,
            ''
        );


    if (
        value.startsWith('+')
    ) {

        value =
            value.slice(1);
    }


    if (
        /^0\d{10}$/.test(value)
    ) {

        value =
            `234${value.slice(1)}`;
    }


    if (
        !/^234\d{10}$/.test(value)
    ) {

        throw new Error(
            `Invalid Nigerian SMS recipient number: ${phoneNumber}`
        );
    }


    return value;
}


/**
 * Validate an SMS message.
 *
 * @param {string} message
 * @returns {string}
 */
function validateMessage(message) {

    if (
        message === null ||
        message === undefined
    ) {

        throw new Error(
            'SMS message is required.'
        );
    }


    const value =
        String(message).trim();


    if (!value) {

        throw new Error(
            'SMS message cannot be empty.'
        );
    }


    return value;
}


/**
 * Send an SMS through Termii.
 *
 * This function contains no NDUKA business wording.
 * The caller supplies the recipient and message.
 *
 * @param {Object} data
 * @param {string|number} data.to
 * @param {string} data.message
 * @param {number} data.timeoutMs
 * @returns {Promise<Object>}
 */
async function sendSms({
    to,
    message,
    timeoutMs = DEFAULT_TIMEOUT_MS
}) {

    const config =
        getConfig();


    const recipient =
        normalizeNigeriaPhoneNumber(to);

    const sms =
        validateMessage(message);


    const endpoint =
        `${config.baseUrl}/api/sms/send`;


    const payload = {

        api_key:
            config.apiKey,

        to:
            recipient,

        from:
            config.senderId,

        sms,

        type:
            'plain',

        channel:
            config.channel
    };


    const controller =
        new AbortController();


    const timeout =
        setTimeout(
            () => {
                controller.abort();
            },
            timeoutMs
        );


    let response;


    try {

        response =
            await fetch(
                endpoint,
                {
                    method:
                        'POST',

                    headers: {
                        'Content-Type':
                            'application/json'
                    },

                    body:
                        JSON.stringify(payload),

                    signal:
                        controller.signal
                }
            );

    } catch (error) {

        if (
            error.name ===
            'AbortError'
        ) {

            throw new Error(
                `Termii SMS request timed out after ${timeoutMs}ms.`
            );
        }


        throw new Error(
            `Termii SMS request failed: ${error.message}`
        );

    } finally {

        clearTimeout(timeout);
    }


    let responseBody;


    try {

        responseBody =
            await response.json();

    } catch (error) {

        throw new Error(
            `Termii returned an invalid JSON response (HTTP ${response.status}).`
        );
    }


    if (!response.ok) {

        const providerMessage =
            responseBody?.message ||
            responseBody?.error ||
            `HTTP ${response.status}`;


        throw new Error(
            `Termii SMS delivery failed: ${providerMessage}`
        );
    }


    if (
        responseBody?.code &&
        responseBody.code !== 'ok'
    ) {

        throw new Error(
            `Termii SMS delivery failed: ${
                responseBody.message ||
                'Unknown provider error'
            }`
        );
    }


    if (
        !responseBody?.message_id
    ) {

        throw new Error(
            'Termii accepted the request but did not return a message_id.'
        );
    }


    return {

        providerName:
            'TERMII',

        providerReference:
            responseBody.message_id_str ||
            responseBody.message_id,

        messageId:
            responseBody.message_id_str ||
            responseBody.message_id,

        message:
            responseBody.message ||
            null,

        balance:
            responseBody.balance !== undefined
                ? responseBody.balance
                : null,

        rawResponse:
            responseBody
    };
}


module.exports = {

    normalizeNigeriaPhoneNumber,

    sendSms
};
