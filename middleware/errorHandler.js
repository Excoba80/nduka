


// Global Error Handler
module.exports = (err, req, res, next) => {

    const status = err.status || err.statusCode || 500;

    /*
     * CSRF validation failure.
     *
     * Do not expose the internal error or stack trace
     * to the user.
     */
    if (
        err.code === 'EBADCSRFTOKEN' ||
        (
            status === 403 &&
            err.message === 'invalid csrf token'
        )
    ) {

        console.warn(
            'CSRF validation failed:',
            req.method,
            req.originalUrl,
            req.ip
        );

        return res.status(403).render('error', {
            title: 'Request Rejected',
            message:
                'Your security token is invalid or has expired. Please refresh the page and try again.',
            error: {}
        });
    }

   /*
 * General application errors.
 *
 * Development:
 *   Show the actual error for debugging.
 *
 * Production:
 *   Never expose internal error details.
 */
res.status(status);

return res.render('error', {
    title: 'Error',
    message:
        process.env.NODE_ENV === 'development'
            ? (err.message || 'An unexpected error occurred.')
            : 'An unexpected error occurred. Please try again later.',
    error:
        process.env.NODE_ENV === 'development'
            ? err
            : {}
});

};