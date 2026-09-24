'use strict';

const rateLimit = require('express-rate-limit');


/*
 * Login rate limiter.
 *
 * Limits repeated authentication attempts
 * from the same IP address.
 */
const loginRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,

    limit: 10,

    standardHeaders: 'draft-8',

    legacyHeaders: false,

    message: {
        success: false,
        message: 'Too many login attempts. Please try again later.'
    }
});


/*
 * Administrative password-reset rate limiter.
 *
 * Limits repeated password-reset requests
 * from the same IP address.
 */
const passwordResetRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,

    limit: 5,

    standardHeaders: 'draft-8',

    legacyHeaders: false,

    message: {
        success: false,
        message: 'Too many password reset attempts. Please try again later.'
    }
});


/*
 * Public Investigation Request creation
 * rate limiter.
 *
 * Creating an Investigation Request writes
 * public-submission data to the database and
 * may trigger notification processing.
 */
const publicInvestigationRequestRateLimiter =
    rateLimit({
        windowMs: 15 * 60 * 1000,

        limit: 5,

        standardHeaders: 'draft-8',

        legacyHeaders: false,

        message: {
            success: false,
            message: 'Too many Investigation Request submissions. Please try again later.'
        }
    });


/*
 * Public Investigation Request status
 * rate limiter.
 *
 * Allows reasonable repeated status checks while
 * limiting automated probing of public request
 * references.
 */
const publicRequestStatusRateLimiter =
    rateLimit({
        windowMs: 15 * 60 * 1000,

        limit: 20,

        standardHeaders: 'draft-8',

        legacyHeaders: false,

        message: {
            success: false,
            message: 'Too many status-check attempts. Please try again later.'
        }
    });


/*
 * Public Investigation Request payment-intent
 * rate limiter.
 *
 * Limits repeated attempts to change the payment
 * intent state for public requests.
 */
const publicPaymentIntentRateLimiter =
    rateLimit({
        windowMs: 15 * 60 * 1000,

        limit: 10,

        standardHeaders: 'draft-8',

        legacyHeaders: false,

        message: {
            success: false,
            message: 'Too many payment attempts. Please try again later.'
        }
    });


/*
 * Public Investigation Service Feedback
 * rate limiter.
 *
 * Limits repeated service-suggestion submissions
 * without affecting Investigation Request submissions.
 */
const publicInvestigationServiceFeedbackRateLimiter =
    rateLimit({
        windowMs: 15 * 60 * 1000,

        limit: 5,

        standardHeaders: 'draft-8',

        legacyHeaders: false,

        message: {
            success: false,
            message: 'Too many service suggestions. Please try again later.'
        }
    });


module.exports = {
    loginRateLimiter,
    passwordResetRateLimiter,
    publicInvestigationRequestRateLimiter,
    publicRequestStatusRateLimiter,
    publicPaymentIntentRateLimiter,
    publicInvestigationServiceFeedbackRateLimiter
};
