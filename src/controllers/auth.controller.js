'use strict';

const authService = require('../services/auth.service');
const auditService = require('../services/audit.service');
const clientAccountService =
    require('../services/client-account.service');

/**
 * Display the login page.
 */
function getLogin(req, res) {
    res.render('auth/login', {
        title: 'Sign In',
        showNavbar: false,
        showFooter: false,
        error: null
    });
}

/**
 * Process login.
 */


async function postLogin(req, res, next) {

    try {

        const { username, password } = req.body;

        const user = await authService.authenticate(
            username,
            password
        );

        /*
         * Regenerate session to protect against
         * session fixation.
         */
        req.session.regenerate((err) => {

            if (err) {
                return next(err);
            }

            /*
             * Store the authenticated user in
             * the new session.
             */
            req.session.user = user;

            /*
             * Persist the session before redirecting.
             */
            req.session.save(async (err) => {

                if (err) {
                    return next(err);
                }

                try {

                    /*
                     * Centralized audit:
                     * successful login.
                     */
                    await auditService.log({
                        actorUserId: user.id,
                        action: 'LOGIN_SUCCESS',
                        targetUserId: null,
                        description: 'User logged in successfully.',
                        ipAddress: req.ip,
                        userAgent: req.get('user-agent')
                    });

                    return res.redirect('/dashboard');

                } catch (auditError) {

                    /*
                     * The authentication and session have
                     * already succeeded. An audit failure
                     * should not turn a successful login
                     * into a failed login.
                     */
                    console.error(
                        'Failed to record LOGIN_SUCCESS audit:',
                        auditError
                    );

                    return res.redirect('/dashboard');
                }
            });
        });

} catch (err) {

    /*
     * Invalid credentials.
     */
    if (
        err.message === 'Invalid username or password.'
    ) {

        try {

            await auditService.log({
                actorUserId: null,
                action: 'LOGIN_FAILED',
                targetUserId: null,
                description:
                    'Login failed: Invalid username or password.',
                ipAddress: req.ip,
                userAgent: req.get('user-agent')
            });

        } catch (auditError) {

            console.error(
                'Failed to record LOGIN_FAILED audit:',
                auditError
            );
        }
    }

    /*
     * Account exists but is inactive.
     */
    else if (
        err.code === 'ACCOUNT_INACTIVE'
    ) {

        try {

            await auditService.log({
                actorUserId: null,
                action: 'LOGIN_BLOCKED',
                targetUserId: err.userId,
                description:
                    'Login blocked because the account is not active.',
                ipAddress: req.ip,
                userAgent: req.get('user-agent')
            });

        } catch (auditError) {

            console.error(
                'Failed to record LOGIN_BLOCKED audit:',
                auditError
            );
        }
    }

    /*
     * Preserve the existing login response.
     */
    return res.status(401).render('auth/login', {
        title: 'Sign In',
        showNavbar: false,
        showFooter: false,
        error: err.message
    });
}

}



/**
 * Display the Client account activation page.
 */
async function getClientAccountActivation(
    req,
    res,
    next
) {

    const token =
        typeof req.query.token === 'string'
            ? req.query.token.trim()
            : '';

    try {

        if (!token) {

            return res.status(400).render(
                'auth/activate',
                {
                    title:
                        'Activate Client Account',

                    token: '',

                    activation: null,

                    error:
                        'The Client account activation link is incomplete.'
                }
            );

        }

        const activation =
            await clientAccountService
                .getClientAccountActivation(
                    token
                );

        if (!activation) {

            return res.status(400).render(
                'auth/activate',
                {
                    title:
                        'Activate Client Account',

                    token: '',

                    activation: null,

                    error:
                        'This Client account activation link is invalid.'
                }
            );

        }

        if (!activation.valid) {

            const messages = {
                USED:
                    'This Client account activation link has already been used.',

                REVOKED:
                    'This Client account activation link has been revoked.',

                EXPIRED:
                    'This Client account activation link has expired.'
            };

            return res.status(400).render(
                'auth/activate',
                {
                    title:
                        'Activate Client Account',

                    token: '',

                    activation: null,

                    error:
                        messages[
                            activation.reason
                        ] ||
                        'This Client account activation link is no longer valid.'
                }
            );

        }

        return res.render(
            'auth/activate',
            {
                title:
                    'Activate Client Account',

                token,

                activation,

                error: null
            }
        );

    } catch (error) {

        next(error);

    }
}


/**
 * Complete Client account activation.
 */
async function postClientAccountActivation(
    req,
    res,
    next
) {

    const {
        token,
        password,
        confirm_password
    } = req.body;

    const normalizedToken =
        typeof token === 'string'
            ? token.trim()
            : '';

    try {

        if (!normalizedToken) {

            return res.status(400).render(
                'auth/activate',
                {
                    title:
                        'Activate Client Account',

                    token: '',

                    activation: null,

                    error:
                        'The Client account activation link is incomplete.'
                }
            );

        }

        if (
            typeof password !== 'string' ||
            !password
        ) {

            const activation =
                await clientAccountService
                    .getClientAccountActivation(
                        normalizedToken
                    );

            return res.status(400).render(
                'auth/activate',
                {
                    title:
                        'Activate Client Account',

                    token:
                        normalizedToken,

                    activation,

                    error:
                        'Please enter a password.'
                }
            );

        }

        if (
            password !== confirm_password
        ) {

            const activation =
                await clientAccountService
                    .getClientAccountActivation(
                        normalizedToken
                    );

            return res.status(400).render(
                'auth/activate',
                {
                    title:
                        'Activate Client Account',

                    token:
                        normalizedToken,

                    activation,

                    error:
                        'Passwords do not match.'
                }
            );

        }

        const result =
            await clientAccountService
                .activateClientAccount(
                    normalizedToken,
                    password
                );

        try {

            await auditService.log({
                actorUserId:
                    result.userId,

                action:
                    'ACTIVATE_CLIENT_ACCOUNT',

                targetUserId:
                    result.userId,

                description:
                    `Client account ${result.username} was activated successfully.`,

                ipAddress:
                    req.ip,

                userAgent:
                    req.get('user-agent')
            });

        } catch (auditError) {

            console.error(
                'Failed to record ACTIVATE_CLIENT_ACCOUNT audit:',
                auditError
            );

        }

        return res.redirect('/login');

    } catch (error) {

        const knownErrors = [
            'A Client account activation token is required.',
            'Password must be at least 8 characters long.',
            'This Client account activation link is invalid.',
            'This Client account activation link has already been used.',
            'This Client account activation link has been revoked.',
            'This Client account activation link has expired.',
            'Client account password could not be established.',
            'Client account activation could not be completed.'
        ];

        if (
            knownErrors.includes(
                error.message
            )
        ) {

            let activation = null;

            try {

                activation =
                    await clientAccountService
                        .getClientAccountActivation(
                            normalizedToken
                        );

            } catch (lookupError) {

                console.error(
                    'Failed to reload Client account activation:',
                    lookupError
                );

            }

            return res.status(400).render(
                'auth/activate',
                {
                    title:
                        'Activate Client Account',

                    token:
                        normalizedToken,

                    activation,

                    error:
                        error.message
                }
            );

        }

        next(error);
    }
}



/**
 * Logout.
 */
function logout(req, res, next) {

    const userId = req.session && req.session.user
        ? req.session.user.id
        : null;

    const ipAddress = req.ip;
    const userAgent = req.get('user-agent');

    req.session.destroy(async (err) => {

        if (err) {
            return next(err);
        }

        try {

            await auditService.log({
                actorUserId: userId,
                action: 'LOGOUT',
                targetUserId: null,
                description: 'User logged out successfully.',
                ipAddress,
                userAgent
            });

            res.clearCookie('nduka.sid');

            res.redirect('/login');

        } catch (error) {

            next(error);

        }
    });
}



module.exports = {
    getLogin,
    postLogin,
    getClientAccountActivation,
    postClientAccountActivation,
    logout
};