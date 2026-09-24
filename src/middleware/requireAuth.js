
async function requireAuth(req, res, next) {

    if (!req.session || !req.session.user) {
        return res.redirect('/login');
    }

    try {

        const pool = require('../config/database');

        const [users] = await pool.execute(
            `
            SELECT
                session_version
            FROM users
            WHERE id = ?
            LIMIT 1
            `,
            [req.session.user.id]
        );

        if (users.length === 0) {

            return req.session.destroy(() => {
                res.clearCookie('nduka.sid');
                res.redirect('/login');
            });

        }

        const currentSessionVersion = users[0].session_version;

        if (
            req.session.user.sessionVersion !==
            currentSessionVersion
        ) {

            return req.session.destroy(() => {
                res.clearCookie('nduka.sid');
                res.redirect('/login');
            });

        }

        next();

    } catch (error) {

        next(error);

    }

}


module.exports = requireAuth ;