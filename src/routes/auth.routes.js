'use strict';

const express = require('express');
const router = express.Router();

const authController = require('../controllers/auth.controller');
const {loginRateLimiter} = require('../middleware/rate-limit.middleware');

const {csrfSynchronisedProtection} = require('../config/csrf');


/*
|--------------------------------------------------------------------------
| Authentication Routes
|--------------------------------------------------------------------------
*/

/*
 * Display login page.
 */
router.get(
    '/login',
    authController.getLogin
);


/*
 * Process login.
 *
 * Login is intentionally outside the initial
 * CSRF enforcement boundary.
 */
router.post(
    '/login',
    loginRateLimiter,
    authController.postLogin
);


/*
 * Display Client account activation page.
 *
 * The activation token is supplied in the URL.
 */
router.get(
    '/activate',
    authController.getClientAccountActivation
);


/*
 * Complete Client account activation.
 *
 * Requires a valid CSRF token.
 */
router.post(
    '/activate',
    csrfSynchronisedProtection,
    authController.postClientAccountActivation
);


/*
 * Logout.
 *
 * Requires a valid CSRF token.
 */
router.post(
    '/logout',
    csrfSynchronisedProtection,
    authController.logout
);


module.exports = router;