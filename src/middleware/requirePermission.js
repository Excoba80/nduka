
'use strict';

const pool = require('../config/database');

/**
 * Authorization Middleware
 *
 * Checks whether the authenticated user has
 * the required permission.
 *
 * Usage:
 *
 * router.get(
 *     '/users',
 *     requireAuth,
 *     requirePermission('view_user'),
 *     controller.index
 * );
 */


function requirePermission(permissionName) {

    return async function (req, res, next) {

        try {

            // Authentication must already have taken place.
            if (!req.session?.user?.id) {
                return res.redirect('/login');
            }

            const userId = req.session.user.id;

            const [permissions] = await pool.execute(
                `
                SELECT 1
                FROM user_roles ur
                INNER JOIN role_permissions rp
                    ON rp.role_id = ur.role_id
                INNER JOIN permissions p
                    ON p.id = rp.permission_id
                WHERE ur.user_id = ?
                  AND p.name = ?
                LIMIT 1
                `,
                [userId, permissionName]
            );

            if (permissions.length === 0) {
                return res.status(403).render('error', {
                    title: 'Access Denied',
                    message: 'You do not have permission to perform this action.',
                    error: {
                        status: 403
                    }
                });
            }

            next();

        } catch (err) {

            next(err);

        }

    };
}

module.exports = requirePermission;