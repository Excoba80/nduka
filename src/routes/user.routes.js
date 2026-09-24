'use strict';

const express = require('express');

const requireAuth = require('../middleware/requireAuth');
const requirePermission = require('../middleware/requirePermission');

const { csrfSynchronisedProtection} = require('../config/csrf');
const { passwordResetRateLimiter} = require('../middleware/rate-limit.middleware');

const userController = require('../controllers/user.controller');

const router = express.Router();


/*
 * User Management
 *
 * Requires:
 * - authenticated session
 * - appropriate permission
 */


/*
 * User list.
 */
router.get(
    '/users',
    requireAuth,
    requirePermission('view_user'),
    userController.index
);





 /*
  * Authenticated user's own profile.
  *
  * Available to every authenticated user.
  */
 router.get(
     '/profile',
     requireAuth,
     userController.profile
 );


/*
 * Change own password form.
 */
router.get(
    '/change-password',
    requireAuth,
    userController.changePasswordForm
);


/*
 * Change own password.
 */
router.post(
    '/change-password',
    requireAuth,
    csrfSynchronisedProtection,
    userController.changePassword
);


/*
 * Create user form.
 */
router.get(
    '/users/new',
    requireAuth,
    requirePermission('create_user'),
    userController.createForm
);


/*
 * Create user.
 */
router.post(
    '/users',
    requireAuth,
    requirePermission('create_user'),
    csrfSynchronisedProtection,
    userController.create
);


/*
 * Edit user form.
 */
router.get(
    '/users/:id/edit',
    requireAuth,
    requirePermission('update_user'),
    userController.editForm
);


/*
 * Update user.
 */
router.post(
    '/users/:id',
    requireAuth,
    requirePermission('update_user'),
    csrfSynchronisedProtection,
    userController.update
);


/*
 * Suspend user.
 */
router.post(
    '/users/:id/suspend',
    requireAuth,
    requirePermission('suspend_user'),
    csrfSynchronisedProtection,
    userController.suspend
);


/*
 * Reactivate user.
 */
router.post(
    '/users/:id/reactivate',
    requireAuth,
    requirePermission('reactivate_user'),
    csrfSynchronisedProtection,
    userController.reactivate
);



/*
 * Reset user password.
 */
router.post(
    '/users/:id/reset-password',
    requireAuth,
    requirePermission('reset_user_password'),
    csrfSynchronisedProtection,
    passwordResetRateLimiter,
    userController.resetPassword
);


/*
 * User details.
 */
router.get(
    '/users/:id',
    requireAuth,
    requirePermission('view_user'),
    userController.show
);


module.exports = router;