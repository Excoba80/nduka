'use strict';

const {
    csrfSync
} = require('csrf-sync');


const {
    csrfSynchronisedProtection,
    generateToken,
    invalidCsrfTokenError
} = csrfSync({

    /*
     * Read the token submitted by our HTML forms.
     */
    getTokenFromRequest: (req) => {
        return req.body?._csrf;
    }
});


/**
 * Expose the CSRF token to Pug views.
 *
 * csrf-sync stores the canonical token in
 * req.session.csrfToken by default.
 */
function csrfContext(req, res, next) {

    try {

        res.locals.csrfToken = generateToken(req);

        next();

    } catch (error) {

        next(error);
    }
}


module.exports = {
    csrfSynchronisedProtection,
    csrfContext,
    invalidCsrfTokenError
};