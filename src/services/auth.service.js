


'use strict';

const bcrypt = require('bcrypt');
const pool = require('../config/database');

/**
 * Authenticate a user by username and password.
 *
 * @param {string} username
 * @param {string} password
 * @returns {Promise<Object>}
 * @throws {Error}
 */
async function authenticate(username, password) {

    // Basic validation
username = username ? username.trim() : '';
password = password ? password : '';

if (!username || !password) {
    throw new Error('Username and password are required.');
}

    // Retrieve the user
    const [users] = await pool.execute(
        `
        SELECT
            u.id,
            u.username,
            u.password_hash,
            u.first_name,
            u.last_name,
            u.email,
            u.session_version,
            us.name AS status,
            cua.client_id
        FROM users u
        INNER JOIN user_statuses us
            ON us.id = u.status_id
        LEFT JOIN client_user_accounts cua
            ON cua.user_id = u.id
        WHERE u.username = ?
        LIMIT 1
        `,
        [username]
    );

    if (users.length === 0) {
        throw new Error('Invalid username or password.');
    }

    const user = users[0];

    // Account status check
  // Account status check
if (user.status.toLowerCase() !== 'active') {

    const error = new Error(
        'This account is not active.'
    );

    error.code = 'ACCOUNT_INACTIVE';
    error.userId = user.id;

    throw error;
}

    // Password verification
    const passwordMatches = await bcrypt.compare(
        password,
        user.password_hash
    );

    if (!passwordMatches) {
        throw new Error('Invalid username or password.');
    }

    // Load user roles
    const [roles] = await pool.execute(
        `
        SELECT
            r.name
        FROM user_roles ur
        INNER JOIN roles r
            ON r.id = ur.role_id
        WHERE ur.user_id = ?
        ORDER BY r.name
        `,
        [user.id]
    );

	const [permissions] = await pool.execute(
    `
    SELECT DISTINCT
        p.name
    FROM user_roles ur
    INNER JOIN role_permissions rp
        ON rp.role_id = ur.role_id
    INNER JOIN permissions p
        ON p.id = rp.permission_id
    WHERE ur.user_id = ?
    ORDER BY p.name
    `,
    [user.id]
);


   return {
    id: user.id,
    username: user.username,
    firstName: user.first_name,
    lastName: user.last_name,
    email: user.email,
    sessionVersion: user.session_version,
    clientId: user.client_id ? Number(user.client_id) : null,
    roles: roles.map(role => role.name),
    permissions: permissions.map(permission => permission.name)
};


}

module.exports = {
    authenticate
};
