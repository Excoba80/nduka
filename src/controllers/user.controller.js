
'use strict';

const userService = require('../services/user.service');
const auditService = require('../services/audit.service');


/**
 * Display the user management page.
 */
async function index(req, res, next) {

    try {

        const users = await userService.getAllUsers();

        res.render('users/index', {
            title: 'User Management',
            users
        });

    } catch (error) {

        next(error);

    }
}





/**
 * Display the authenticated user's own profile.
 */
/**
 * Display the authenticated user's own profile.
 */
async function profile(req, res, next) {
    try {
        const userId = req.session.user.id;

        const user = await userService.getOwnProfile(userId);

        if (!user) {
            return next(
                new Error(
                    'Authenticated user profile could not be found.'
                )
            );
        }

        return res.render(
            'users/profile',
            {
                title: 'My Profile',
                user
            }
        );
    } catch (error) {
        next(error);
    }
}






/**
 * Display an individual user's details.
 */
async function show(req, res, next) {

    try {

        const userId = Number(req.params.id);

        if (!Number.isInteger(userId) || userId <= 0) {
            return res.status(404).render('error', {
                title: 'User Not Found',
                message: 'The requested user could not be found.'
            });
        }

        const user = await userService.getUserById(userId);

        if (!user) {
            return res.status(404).render('error', {
                title: 'User Not Found',
                message: 'The requested user could not be found.'
            });
        }

        res.render('users/show', {
            title: 'User Details',
            user
        });

    } catch (error) {

        next(error);

    }
}

/**
 * Display the create-user form.
 */
async function createForm(req, res, next) {

    try {

        const roles = await userService.getAllRoles();

        res.render('users/new', {
            title: 'Add User',
            error: null,
            formData: {},
            roles
        });

    } catch (error) {

        next(error);

    }

}




/**
 * Create a new user.
 */
async function create(req, res, next) {

    const {
        first_name,
        last_name,
        username,
        email,
        phone,
        role_id,
        password,
        confirm_password
    } = req.body;

    const formData = {
        first_name,
        last_name,
        username,
        email,
        phone,
        role_id
    };

    try {

        /*
         * Basic required-field validation.
         */
        if (
            !first_name ||
            !last_name ||
            !username ||
            !email ||
            !phone ||
            !role_id ||
            !password ||
            !confirm_password
        ) {
            return res.status(400).render('users/new', {
                title: 'Add User',
                error: 'All fields are required.',
                formData,
                roles: await userService.getAllRoles()
            });
        }

        /*
         * Password confirmation.
         */
        if (password !== confirm_password) {
            return res.status(400).render('users/new', {
                title: 'Add User',
                error: 'Passwords do not match.',
                formData,
                roles: await userService.getAllRoles()
            });
        }

        /*
         * Password strength.
         *
         * Minimum: 8 characters.
         */
        if (password.length < 8) {
            return res.status(400).render('users/new', {
                title: 'Add User',
                error: 'Password must be at least 8 characters long.',
                formData,
                roles: await userService.getAllRoles()
            });
        }

        /*
         * Validate role ID.
         */
        const roleId = Number(role_id);

        if (!Number.isInteger(roleId) || roleId <= 0) {
            return res.status(400).render('users/new', {
                title: 'Add User',
                error: 'Please select a valid role.',
                formData,
                roles: await userService.getAllRoles()
            });
        }

        /*
         * Normalize values before sending them to the service.
         */
        const userData = {
            firstName: first_name.trim(),
            lastName: last_name.trim(),
            username: username.trim(),
            email: email.trim().toLowerCase(),
            phone: phone.trim(),
            roleId,
            password,
            createdBy: req.session.user.id
        };

        /*
         * Create user.
         */
/*
 * Create user.
 */
	const userId = await userService.createUser(userData);

	/*
	 * Record the user creation in the audit log.
	 */
	await auditService.log({
		actorUserId: req.session.user.id,
		action: 'CREATE_USER',
		targetUserId: userId,
		description: 'User account created.',
		ipAddress: req.ip,
		userAgent: req.get('user-agent')
	});

	/*
	 * Redirect to the newly created user's profile.
	 */
	return res.redirect(`/users/${userId}`);

    } catch (error) {

        /*
         * Expected business/database errors are displayed
         * back on the form.
         */
        if (
            error.message === 'Username already exists.' ||
            error.message === 'Email address already exists.' ||
            error.message === 'Phone number already exists.' ||
            error.message === 'Selected role does not exist.'
        ) {
            return res.status(400).render('users/new', {
                title: 'Add User',
                error: error.message,
                formData,
                roles: await userService.getAllRoles()
            });
        }

        /*
         * Unexpected errors go to the central error handler.
         */
        next(error);
    }
}




/**
 * Display the edit-user form.
 */
async function editForm(req, res, next) {

    try {

        const userId = Number(req.params.id);

        if (!Number.isInteger(userId) || userId <= 0) {
            return res.status(404).render('error', {
                title: 'User Not Found',
                message: 'The requested user could not be found.'
            });
        }

        const user = await userService.getUserById(userId);

        if (!user) {
            return res.status(404).render('error', {
                title: 'User Not Found',
                message: 'The requested user could not be found.'
            });
        }

        const roles = await userService.getAllRoles();

        res.render('users/edit', {
            title: 'Edit User',
            user,
            roles,
            error: null
        });

    } catch (error) {

        next(error);

    }

}





/**
 * Update an existing user.
 */
async function update(req, res, next) {


    const userId = Number(req.params.id);

    const {
        first_name,
        last_name,
        username,
        email,
        phone,
        role_id
    } = req.body;

    const formData = {
        first_name,
        last_name,
        username,
        email,
        phone,
        role_id
    };

    try {

        /*
         * Validate user ID.
         */
        if (!Number.isInteger(userId) || userId <= 0) {
            return res.status(404).render('error', {
                title: 'User Not Found',
                message: 'The requested user could not be found.'
            });
        }

        /*
         * Basic required-field validation.
         */
        if (
            !first_name ||
            !last_name ||
            !username ||
            !email ||
            !phone ||
            !role_id
        ) {

            return res.status(400).render('users/edit', {
                title: 'Edit User',
                error: 'All fields are required.',
                formData,
                user: {
                    id: userId,
                    ...formData
                },
                roles: await userService.getAllRoles()
            });
        }

        /*
         * Validate role ID.
         */
        const roleId = Number(role_id);

        if (!Number.isInteger(roleId) || roleId <= 0) {

            return res.status(400).render('users/edit', {
                title: 'Edit User',
                error: 'Please select a valid role.',
                formData,
                user: {
                    id: userId,
                    ...formData
                },
                roles: await userService.getAllRoles()
            });
        }

        /*
         * Normalize values.
         */
        const userData = {
            firstName: first_name.trim(),
            lastName: last_name.trim(),
            username: username.trim(),
            email: email.trim().toLowerCase(),
            phone: phone.trim(),
            roleId,
            updatedBy: req.session.user.id
        };

        /*
         * Update user.
         */
/*
 * Update user.
 */
    await userService.updateUser(
        userId,
        userData
    );

    /*
    * Record the user update in the audit log.
    */
    await auditService.log({
        actorUserId: req.session.user.id,
        action: 'UPDATE_USER',
        targetUserId: userId,
        description: 'User account updated.',
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
    });

    /*
    * Redirect to updated user.
    */
    return res.redirect(`/users/${userId}`);

    } catch (error) {

        /*
         * Expected business/database errors.
         */
        if (
            error.message === 'User not found.' ||
            error.message === 'Username already exists.' ||
            error.message === 'Email address already exists.' ||
            error.message === 'Phone number already exists.' ||
            error.message === 'Selected role does not exist.'||
            error.message === 'The super administrator account cannot be modified.'||
            error.message === 'Administrators cannot modify another administrator.'||
            error.message === 'Administrators cannot assign privileged roles.'||
            error.message === 'The super administrator role cannot be changed.'

        ) {

            return res.status(400).render('users/edit', {
                title: 'Edit User',
                error: error.message,
                formData,
                user: {
                    id: userId,
                    ...formData
                },
                roles: await userService.getAllRoles()
            });
        }

        /*
         * Unexpected errors.
         */
        next(error);
    }
}


/**
 * Suspend a user.
 */


async function suspend(req, res, next) {

    const userId = Number(req.params.id);

    try {

        if (!Number.isInteger(userId) || userId <= 0) {
            return res.status(404).render('error', {
                title: 'User Not Found',
                message: 'The requested user could not be found.'
            });
        }

        await userService.suspendUser(
            userId,
            req.session.user.id
        );

        /*
         * Record the successful user suspension
         * in the centralized audit log.
         */
        try {

            await auditService.log({
                actorUserId: req.session.user.id,
                action: 'SUSPEND_USER',
                targetUserId: userId,
                description: 'User account suspended.',
                ipAddress: req.ip,
                userAgent: req.get('user-agent')
            });

        } catch (auditError) {

            /*
             * The suspension already succeeded.
             * Do not turn an audit failure into an
             * apparent suspension failure.
             */
            console.error(
                'Failed to record SUSPEND_USER audit:',
                auditError
            );
        }

        return res.redirect(`/users/${userId}`);

    } catch (error) {

        if (
            error.message === 'User not found.' ||
            error.message === 'User is already suspended.' ||
            error.message === 'User could not be suspended.' ||
            error.message ===
                'The super administrator account cannot be suspended.' ||
            error.message ===
                'Administrators cannot suspend another administrator.'
        ) {

            /*
             * The suspension operation was attempted but
             * failed. Record the security event.
             */
            try {

                await auditService.log({
                    actorUserId: req.session.user.id,
                    action: 'SUSPEND_USER_FAILED',
                    targetUserId: userId,
                    description:
                        `User suspension failed: ${error.message}`,
                    ipAddress: req.ip,
                    userAgent: req.get('user-agent')
                });

            } catch (auditError) {

                console.error(
                    'Failed to record SUSPEND_USER_FAILED audit:',
                    auditError
                );
            }

            return res.status(400).render('error', {
                title: 'Unable to Suspend User',
                message: error.message
            });
        }

        next(error);
    }
}



/**
 * Reactivate a user.
 */

async function reactivate(req, res, next) {

    const userId = Number(req.params.id);

    try {

        if (!Number.isInteger(userId) || userId <= 0) {
            return res.status(404).render('error', {
                title: 'User Not Found',
                message: 'The requested user could not be found.'
            });
        }

        await userService.reactivateUser( userId, req.session.user.id );

        /*
         * Record the successful user reactivation
         * in the centralized audit log.
         */
        try {

            await auditService.log({
                actorUserId: req.session.user.id,
                action: 'REACTIVATE_USER',
                targetUserId: userId,
                description: 'User account reactivated.',
                ipAddress: req.ip,
                userAgent: req.get('user-agent')
            });

        } catch (auditError) {

            /*
             * The reactivation already succeeded.
             * Do not turn an audit failure into an
             * apparent reactivation failure.
             */
            console.error(
                'Failed to record REACTIVATE_USER audit:',
                auditError
            );
        }

        return res.redirect(`/users/${userId}`);

    } catch (error) {

if (
    error.message === 'User not found.' ||
    error.message === 'User is already active.' ||
    error.message === 'Only suspended users can be reactivated.' ||
    error.message === 'User could not be reactivated.' ||
    error.message ===
        'Only the super administrator can reactivate a user suspended by the super administrator.'
) {

            /*
             * The reactivation operation was attempted
             * but failed. Record the security event.
             */
            try {

                await auditService.log({
                    actorUserId: req.session.user.id,
                    action: 'REACTIVATE_USER_FAILED',
                    targetUserId: userId,
                    description:
                        `User reactivation failed: ${error.message}`,
                    ipAddress: req.ip,
                    userAgent: req.get('user-agent')
                });

            } catch (auditError) {

                console.error(
                    'Failed to record REACTIVATE_USER_FAILED audit:',
                    auditError
                );
            }

            return res.status(400).render('error', {
                title: 'Unable to Reactivate User',
                message: error.message
            });
        }

        next(error);
    }
}


/**
 * Reset a user's password.
 */

async function resetPassword(req, res, next) {

    const userId = Number(req.params.id);

    const {
        password,
        confirm_password
    } = req.body;

    try {

        /*
         * Validate user ID.
         */
        if (!Number.isInteger(userId) || userId <= 0) {
            return res.status(404).render('error', {
                title: 'User Not Found',
                message: 'The requested user could not be found.'
            });
        }

        /*
         * Validate password fields.
         */
        if (!password || !confirm_password) {
            return res.status(400).render('error', {
                title: 'Unable to Reset Password',
                message: 'Password and password confirmation are required.'
            });
        }

        /*
         * Confirm passwords match.
         */
        if (password !== confirm_password) {
            return res.status(400).render('error', {
                title: 'Unable to Reset Password',
                message: 'Passwords do not match.'
            });
        }

        /*
         * Password strength.
         *
         * Minimum: 8 characters.
         */
        if (password.length < 8) {
            return res.status(400).render('error', {
                title: 'Unable to Reset Password',
                message: 'Password must be at least 8 characters long.'
            });
        }

        /*
         * Reset password.
         */
        await userService.resetUserPassword(
            userId,
            password,
            req.session.user.id
        );

        /*
         * Centralized security audit.
         *
         * Successful administrator password reset.
         */
        try {

            await auditService.log({
                actorUserId: req.session.user.id,
                action: 'RESET_PASSWORD',
                targetUserId: userId,
                description: 'Password reset by administrator.',
                ipAddress: req.ip,
                userAgent: req.get('user-agent')
            });

        } catch (auditError) {

            /*
             * Do not treat an audit failure as a password
             * reset failure. The password has already been
             * successfully changed.
             */
            console.error(
                'Failed to record RESET_PASSWORD audit:',
                auditError
            );
        }

        /*
         * Redirect back to the user's profile.
         */
        return res.redirect(`/users/${userId}`);

    } catch (error) {

        /*
         * Centralized security audit.
         *
         * The administrator attempted to reset the password,
         * but the password reset operation failed.
         */
        if (
            error.message === 'User not found.' ||
            error.message === 'Password could not be reset.' ||
            error.message ===
                'Administrators cannot reset the super administrator password.' ||
            error.message ===
                'Administrators cannot reset another administrator password.' ||
            error.message ===
                'Use the change password option to change your own password.'
        ) {

            try {

                await auditService.log({
                    actorUserId: req.session.user.id,
                    action: 'RESET_PASSWORD_FAILED',
                    targetUserId: userId,
                    description:
                        `Administrator password reset failed: ${error.message}`,
                    ipAddress: req.ip,
                    userAgent: req.get('user-agent')
                });

            } catch (auditError) {

                /*
                 * Do not hide the original password-reset
                 * failure because of an audit failure.
                 */
                console.error(
                    'Failed to record RESET_PASSWORD_FAILED audit:',
                    auditError
                );
            }

            return res.status(400).render('error', {
                title: 'Unable to Reset Password',
                message: error.message
            });
        }

        next(error);
    }
}



/**
 * Display the change-password form.
 */
function changePasswordForm(req, res) {

    return res.render('users/change-password', {
        title: 'Change Password',
        error: null,
        success: null
    });
}


/**
 * Change the authenticated user's own password.
 */



async function changePassword(req, res, next) {

    const {
        current_password,
        new_password,
        confirm_password
    } = req.body;

    const formData = {
        current_password: '',
        new_password: '',
        confirm_password: ''
    };

    try {

        /*
         * Required-field validation.
         */
        if (
            !current_password ||
            !new_password ||
            !confirm_password
        ) {

            return res.status(400).render(
                'users/change-password',
                {
                    title: 'Change Password',
                    error: 'All fields are required.',
                    success: null,
                    formData
                }
            );
        }

        /*
         * Confirm the new password.
         */
        if (new_password !== confirm_password) {

            return res.status(400).render(
                'users/change-password',
                {
                    title: 'Change Password',
                    error: 'New passwords do not match.',
                    success: null,
                    formData
                }
            );
        }

        /*
         * Password strength.
         */
        if (new_password.length < 8) {

            return res.status(400).render(
                'users/change-password',
                {
                    title: 'Change Password',
                    error: 'Password must be at least 8 characters long.',
                    success: null,
                    formData
                }
            );
        }

        /*
         * Change the password.
         */
        const newSessionVersion =
            await userService.changeOwnPassword(
                req.session.user.id,
                current_password,
                new_password
            );

        /*
         * Synchronize the current session with the new
         * database session version.
         */
        req.session.user.sessionVersion = newSessionVersion;

        /*
         * Centralized security audit.
         *
         * Successful self-service password change.
         */
        try {

            await auditService.log({
                actorUserId: req.session.user.id,
                action: 'CHANGE_PASSWORD',
                targetUserId: null,
                description: 'User changed their password.',
                ipAddress: req.ip,
                userAgent: req.get('user-agent')
            });

        } catch (auditError) {

            /*
             * The password has already been changed
             * successfully. Do not turn an audit failure
             * into an apparent password-change failure.
             */
            console.error(
                'Failed to record CHANGE_PASSWORD audit:',
                auditError
            );
        }

        /*
         * Persist the updated session.
         */
        req.session.save((err) => {

            if (err) {
                return next(err);
            }

            return res.redirect('/dashboard');
        });

    } catch (error) {

        /*
         * These are genuine password-operation failures.
         * Record them as security events.
         */
        if (
            error.message === 'User not found.' ||
            error.message === 'Current password is incorrect.' ||
            error.message ===
                'New password must be different from your current password.' ||
            error.message === 'Password could not be changed.'
        ) {

            try {

                await auditService.log({
                    actorUserId: req.session.user.id,
                    action: 'CHANGE_PASSWORD_FAILED',
                    targetUserId: null,
                    description:
                        `Password change failed: ${error.message}`,
                    ipAddress: req.ip,
                    userAgent: req.get('user-agent')
                });

            } catch (auditError) {

                /*
                 * Preserve the original password-change
                 * failure if audit logging itself fails.
                 */
                console.error(
                    'Failed to record CHANGE_PASSWORD_FAILED audit:',
                    auditError
                );
            }

            return res.status(400).render(
                'users/change-password',
                {
                    title: 'Change Password',
                    error: error.message,
                    success: null,
                    formData
                }
            );
        }

        next(error);
    }
}



module.exports = {
    index,
    profile,
    show,
    createForm,
    create,
    editForm,
    update,
    suspend,
    reactivate,
    resetPassword,
    changePasswordForm,
    changePassword,
};
