


'use strict';

const bcrypt = require('bcrypt');
const pool = require('../config/database');

/**
 * Get all users for administrative viewing.
 *
 * @returns {Promise<Array>}
 */
async function getAllUsers() {

    const [users] = await pool.execute(
        `
        SELECT
            u.id,
            u.username,
            u.first_name,
            u.last_name,
            u.email,
            u.phone,
            us.name AS status,
            GROUP_CONCAT(
                DISTINCT r.name
                ORDER BY r.name
                SEPARATOR ', '
            ) AS roles,
            u.created_at,
            u.updated_at
        FROM users u

        INNER JOIN user_statuses us
            ON us.id = u.status_id

        LEFT JOIN user_roles ur
            ON ur.user_id = u.id

        LEFT JOIN roles r
            ON r.id = ur.role_id

        GROUP BY
            u.id,
            u.username,
            u.first_name,
            u.last_name,
            u.email,
            u.phone,
            us.name,
            u.created_at,
            u.updated_at

        ORDER BY u.id ASC
        `
    );

    return users;
}



/**
 * Get a single user by ID.
 *
 * @param {number} userId
 * @returns {Promise<Object|null>}
 */


async function getUserById(userId) {

    const [users] = await pool.execute(
        `
        SELECT
            u.id,
            u.username,
            u.first_name,
            u.last_name,
            u.email,
            u.phone,
            us.name AS status,
            ur.role_id,
            r.name AS role_name,
            u.created_at,
            u.updated_at
        FROM users u
        INNER JOIN user_statuses us
            ON us.id = u.status_id
        LEFT JOIN user_roles ur
            ON ur.user_id = u.id
        LEFT JOIN roles r
            ON r.id = ur.role_id
        WHERE u.id = ?
        LIMIT 1
        `,
        [userId]
    );

    if (users.length === 0) {
        return null;
    }

    return {
    id: users[0].id,
    username: users[0].username,
    first_name: users[0].first_name,
    last_name: users[0].last_name,
    email: users[0].email,
    phone: users[0].phone,
    status: users[0].status,
    role_id: users[0].role_id,
    role_name: users[0].role_name,
    roles: users[0].role_name || null,
    created_at: users[0].created_at,
    updated_at: users[0].updated_at
};
}





/**
 * Get the authenticated user's own profile.
 *
 * This deliberately uses a dedicated query instead of
 * getUserById(), because a user may have multiple roles.
 *
 * @param {number} userId
 * @returns {Promise<Object|null>}
 */
async function getOwnProfile(userId) {

    const [users] = await pool.execute(
        `
        SELECT
            u.id,
            u.username,
            u.first_name,
            u.middle_name,
            u.last_name,
            u.phone,
            u.email,
            u.is_email_verified,
            u.is_phone_verified,
            us.name AS status,
            us.display_name AS status_display_name,
            GROUP_CONCAT(
                DISTINCT r.display_name
                ORDER BY r.display_name
                SEPARATOR ', '
            ) AS roles,
            u.created_at,
            u.updated_at,
            u.last_login_at
        FROM users u

        INNER JOIN user_statuses us
            ON us.id = u.status_id

        LEFT JOIN user_roles ur
            ON ur.user_id = u.id

        LEFT JOIN roles r
            ON r.id = ur.role_id

        WHERE u.id = ?
          AND u.deleted_at IS NULL

        GROUP BY
            u.id,
            u.username,
            u.first_name,
            u.middle_name,
            u.last_name,
            u.phone,
            u.email,
            u.is_email_verified,
            u.is_phone_verified,
            us.name,
            us.display_name,
            u.created_at,
            u.updated_at,
            u.last_login_at

        LIMIT 1
        `,
        [userId]
    );

    if (users.length === 0) {
        return null;
    }

    return users[0];
}










/**
 * Get all available roles.
 *
 * @returns {Promise<Array>}
 */
async function getAllRoles() {

    const [roles] = await pool.execute(
        `
        SELECT
            id,
            name
        FROM roles
        ORDER BY id
        `
    );

    return roles;
}




 /**
 * Create a new NDUKA user and assign a role.
 *
 * The user creation and role assignment are performed
 * inside one database transaction.
 *
 * @param {Object} data
 * @returns {Promise<number>} Newly created user ID
 */
/**
 * Create a user using an existing database connection.
 *
 * This helper deliberately does NOT begin, commit, rollback,
 * or release a transaction. The caller owns the transaction.
 *
 * It is used by workflows that must create a user atomically
 * together with other database changes.
 *
 * @param {import('mysql2/promise').PoolConnection} connection
 * @param {Object} data
 * @returns {Promise<number>} Newly created user ID
 */
async function createUserWithConnection(
    connection,
    data
) {

    /*
     * Verify that the selected role exists.
     */
    const [roles] = await connection.execute(
        `
        SELECT
            id
        FROM roles
        WHERE id = ?
        LIMIT 1
        `,
        [data.roleId]
    );

    if (roles.length === 0) {
        throw new Error(
            'Selected role does not exist.'
        );
    }

    /*
     * Client User Accounts require an email address because
     * NDUKA uses email for first-time account activation.
     */
    const isClientUser =
        Number(data.roleId) === 4;

    if (
        isClientUser &&
        (
            typeof data.email !== 'string' ||
            !data.email.trim()
        )
    ) {
        throw new Error(
            'Client User Account email address is required.'
        );
    }


    /*
     * Check username uniqueness.
     */
    const [existingUsername] =
        await connection.execute(
            `
            SELECT
                id
            FROM users
            WHERE username = ?
            LIMIT 1
            `,
            [data.username]
        );

    if (existingUsername.length > 0) {
        throw new Error(
            'Username already exists.'
        );
    }

    /*
     * Internal NDUKA users retain strict email and phone
     * uniqueness.
     *
     * Client User Accounts may share the same representative
     * email address or phone number because one person may
     * represent more than one Client organization.
     */
    if (
        !isClientUser &&
        data.email
    ) {

        const [existingEmail] =
            await connection.execute(
                `
                SELECT
                    id
                FROM users
                WHERE email = ?
                LIMIT 1
                `,
                [data.email]
            );

        if (existingEmail.length > 0) {
            throw new Error(
                'Email address already exists.'
            );
        }

    }

    if (!isClientUser) {

        const [existingPhone] =
            await connection.execute(
                `
                SELECT
                    id
                FROM users
                WHERE phone = ?
                LIMIT 1
                `,
                [data.phone]
            );

        if (existingPhone.length > 0) {
            throw new Error(
                'Phone number already exists.'
            );
        }

    }

    /*
     * Find the active status.
     */
    const [statuses] =
        await connection.execute(
            `
            SELECT
                id
            FROM user_statuses
            WHERE name = 'active'
            LIMIT 1
            `
        );

    if (statuses.length === 0) {
        throw new Error(
            'Active user status was not found.'
        );
    }

    const statusId =
        statuses[0].id;

    /*
     * Hash the password.
     */
    const passwordHash =
        await bcrypt.hash(
            data.password,
            12
        );

    /*
     * Create the user.
     */
    const [userResult] =
        await connection.execute(
            `
            INSERT INTO users (
                username,
                password_hash,
                first_name,
                last_name,
                email,
                phone,
                status_id
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
            `,
            [
                data.username,
                passwordHash,
                data.firstName,
                data.lastName,
                data.email || null,
                data.phone,
                statusId
            ]
        );

    const userId =
        userResult.insertId;

    /*
     * Assign the selected role.
     *
     * assigned_by is nullable, allowing a system-created
     * Client account to have no artificial staff actor.
     */
    await connection.execute(
        `
        INSERT INTO user_roles (
            user_id,
            role_id,
            assigned_by
        )
        VALUES (?, ?, ?)
        `,
        [
            userId,
            data.roleId,
            data.createdBy || null
        ]
    );

    return userId;
}




/**
 * Create a new NDUKA user and assign a role.
 *
 * The user creation and role assignment are performed
 * inside one database transaction.
 *
 * @param {Object} data
 * @returns {Promise<number>} Newly created user ID
 */
async function createUser(data) {

    const connection =
        await pool.getConnection();

    try {

        await connection.beginTransaction();

        const userId =
            await createUserWithConnection(
                connection,
                data
            );

        await connection.commit();

        return userId;

    } catch (error) {

        await connection.rollback();

        throw error;

    } finally {

        connection.release();

    }
}



/**
 * Update an existing user and their role.
 *
 * User password is deliberately excluded.
 * Password changes will use the separate
 * reset_user_password permission/workflow.
 *
 * @param {number} userId
 * @param {Object} data
 * @returns {Promise<void>}
 */





async function updateUser(userId, data) {

    const connection = await pool.getConnection();

    try {

        await connection.beginTransaction();

        /*
         * Confirm the user exists.
         */
        const [users] = await connection.execute(
            `
            SELECT id
            FROM users
            WHERE id = ?
            LIMIT 1
            `,
            [userId]
        );

        if (users.length === 0) {
            throw new Error('User not found.');
        }



/*
 * Protect privileged accounts and roles.
 */
const [targetRoles] = await connection.execute(
    `
    SELECT
        r.name AS role
    FROM user_roles ur
    INNER JOIN roles r
        ON r.id = ur.role_id
    WHERE ur.user_id = ?
    LIMIT 1
    `,
    [userId]
);

const targetRole = targetRoles.length > 0
    ? targetRoles[0].role
    : null;

const [newRoles] = await connection.execute(
    `
    SELECT
        name
    FROM roles
    WHERE id = ?
    LIMIT 1
    `,
    [data.roleId]
);

const newRole = newRoles.length > 0
    ? newRoles[0].name
    : null;

const [actorRoles] = await connection.execute(
    `
    SELECT
        r.name AS role
    FROM user_roles ur
    INNER JOIN roles r
        ON r.id = ur.role_id
    WHERE ur.user_id = ?
    LIMIT 1
    `,
    [data.updatedBy]
);

const actorRole = actorRoles.length > 0
    ? actorRoles[0].role
    : null;

/*
 * Determine whether the actor is editing their own account.
 */
const isSelfEdit = Number(data.updatedBy) === Number(userId);

/*
 * Administrators cannot modify administrators or super_admin accounts.
 */
if (
    actorRole === 'administrator' &&
    (
        targetRole === 'administrator' ||
        targetRole === 'super_admin'
    )
)

{
    if (targetRole === 'super_admin') {
        throw new Error(
            'The super administrator account cannot be modified.'
        );
    }

    throw new Error(
        'Administrators cannot modify another administrator.'
    );
}

/*
 * A super_admin may edit their own profile,
 * but cannot change their own role.
 */
if (
    actorRole === 'super_admin' &&
    targetRole === 'super_admin' &&
    isSelfEdit &&
    newRole !== 'super_admin'
) {
    throw new Error(
        'The super administrator role cannot be changed.'
    );
}

/*
 * The super_admin role cannot be assigned through
 * the normal user-edit operation.
 */
if (
    actorRole !== 'super_admin' &&
    newRole === 'super_admin'
) {
    throw new Error(
        'Administrators cannot assign privileged roles.'
    );
}




        /*
         * Confirm the selected role exists.
         */
        const [roles] = await connection.execute(
            `
            SELECT id
            FROM roles
            WHERE id = ?
            LIMIT 1
            `,
            [data.roleId]
        );

        if (roles.length === 0) {
            throw new Error('Selected role does not exist.');
        }

        /*
         * Check username uniqueness.
         * Exclude the current user.
         */
        const [existingUsername] = await connection.execute(
            `
            SELECT id
            FROM users
            WHERE username = ?
              AND id <> ?
            LIMIT 1
            `,
            [data.username, userId]
        );

        if (existingUsername.length > 0) {
            throw new Error('Username already exists.');
        }

        /*
         * Check email uniqueness.
         */
        const [existingEmail] = await connection.execute(
            `
            SELECT id
            FROM users
            WHERE email = ?
              AND id <> ?
            LIMIT 1
            `,
            [data.email, userId]
        );

        if (existingEmail.length > 0) {
            throw new Error('Email address already exists.');
        }

        /*
         * Check phone uniqueness.
         */
        const [existingPhone] = await connection.execute(
            `
            SELECT id
            FROM users
            WHERE phone = ?
              AND id <> ?
            LIMIT 1
            `,
            [data.phone, userId]
        );

        if (existingPhone.length > 0) {
            throw new Error('Phone number already exists.');
        }

        /*
         * Update user information.
         */
        await connection.execute(
            `
            UPDATE users
            SET
                username = ?,
                first_name = ?,
                last_name = ?,
                email = ?,
                phone = ?
            WHERE id = ?
            `,
            [
                data.username,
                data.firstName,
                data.lastName,
                data.email,
                data.phone,
                userId
            ]
        );

        /*
         * Update the user's role.
         *
         * NDUKA currently assigns one role per user.
         */
        const [roleAssignment] = await connection.execute(
            `
            SELECT id
            FROM user_roles
            WHERE user_id = ?
            LIMIT 1
            `,
            [userId]
        );

        if (roleAssignment.length > 0) {

            await connection.execute(
                `
                UPDATE user_roles
                SET
                    role_id = ?,
                    assigned_by = ?
                WHERE user_id = ?
                `,
                [
                    data.roleId,
                    data.updatedBy,
                    userId
                ]
            );

        } else {

            await connection.execute(
                `
                INSERT INTO user_roles (
                    user_id,
                    role_id,
                    assigned_by
                )
                VALUES (?, ?, ?)
                `,
                [
                    userId,
                    data.roleId,
                    data.updatedBy
                ]
            );

        }

        await connection.commit();

    } catch (error) {

        await connection.rollback();

        throw error;

    } finally {

        connection.release();

    }
}






/**
 * Suspend an active user.
 *
 * @param {number} userId
 * @returns {Promise<void>}
 */

async function suspendUser(userId, actorUserId) {

    /*
     * Protect privileged accounts from administrator actions.
     *
     * Administrators may suspend ordinary users only.
     * Only a super_admin may suspend an administrator.
     * The super_admin account itself cannot be suspended.
     */
    const [targetUsers] = await pool.execute(
        `
        SELECT
            u.id,
            r.name AS role
        FROM users u
        INNER JOIN user_roles ur
            ON ur.user_id = u.id
        INNER JOIN roles r
            ON r.id = ur.role_id
        WHERE u.id = ?
          AND r.name IN ('super_admin', 'administrator')
        LIMIT 1
        `,
        [userId]
    );

    if (targetUsers.length > 0) {

        const targetRole = targetUsers[0].role;

        const [actorUsers] = await pool.execute(
            `
            SELECT
                r.name AS role
            FROM users u
            INNER JOIN user_roles ur
                ON ur.user_id = u.id
            INNER JOIN roles r
                ON r.id = ur.role_id
            WHERE u.id = ?
            ORDER BY
                CASE
                    WHEN r.name = 'super_admin' THEN 1
                    WHEN r.name = 'administrator' THEN 2
                    ELSE 3
                END
            LIMIT 1
            `,
            [actorUserId]
        );

        const actorRole = actorUsers.length > 0
            ? actorUsers[0].role
            : null;

        if (targetRole === 'super_admin') {

            throw new Error(
                'The super administrator account cannot be suspended.'
            );
        }

        if (
            targetRole === 'administrator' &&
            actorRole !== 'super_admin'
        ) {

            throw new Error(
                'Administrators cannot suspend another administrator.'
            );
        }
    }

    /*
     * Suspend the user and record who performed
     * the suspension.
     */
    const [result] = await pool.execute(
        `
        UPDATE users
        SET
            status_id = (
                SELECT id
                FROM user_statuses
                WHERE name = 'suspended'
                LIMIT 1
            ),
            suspended_by_user_id = ?
        WHERE id = ?
          AND status_id = (
              SELECT id
              FROM user_statuses
              WHERE name = 'active'
              LIMIT 1
          )
        `,
        [
            actorUserId,
            userId
        ]
    );

    if (result.affectedRows === 0) {

        const [users] = await pool.execute(
            `
            SELECT
                u.id,
                us.name AS status
            FROM users u
            INNER JOIN user_statuses us
                ON us.id = u.status_id
            WHERE u.id = ?
            LIMIT 1
            `,
            [userId]
        );

        if (users.length === 0) {
            throw new Error('User not found.');
        }

        if (users[0].status === 'suspended') {
            throw new Error('User is already suspended.');
        }

        throw new Error('User could not be suspended.');
    }
}






async function reactivateUser(userId, actorUserId) {

    /*
     * Determine the target user's current status,
     * role and who suspended the account.
     */
    const [users] = await pool.execute(
        `
        SELECT
            u.id,
            us.name AS status,
            u.suspended_by_user_id,
            r.name AS suspended_by_role
        FROM users u
        INNER JOIN user_statuses us
            ON us.id = u.status_id
        LEFT JOIN users su
            ON su.id = u.suspended_by_user_id
        LEFT JOIN user_roles sur
            ON sur.user_id = su.id
        LEFT JOIN roles r
            ON r.id = sur.role_id
        WHERE u.id = ?
        LIMIT 1
        `,
        [userId]
    );

    if (users.length === 0) {
        throw new Error('User not found.');
    }

    const user = users[0];

    if (user.status === 'active') {
        throw new Error('User is already active.');
    }

    if (user.status !== 'suspended') {
        throw new Error('Only suspended users can be reactivated.');
    }

    /*
     * Determine the role of the administrator attempting
     * the reactivation.
     */
    const [actorRoles] = await pool.execute(
        `
        SELECT
            r.name AS role
        FROM user_roles ur
        INNER JOIN roles r
            ON r.id = ur.role_id
        WHERE ur.user_id = ?
        ORDER BY
            CASE
                WHEN r.name = 'super_admin' THEN 1
                WHEN r.name = 'administrator' THEN 2
                ELSE 3
            END
        LIMIT 1
        `,
        [actorUserId]
    );

    const actorRole = actorRoles.length > 0
        ? actorRoles[0].role
        : null;

    /*
     * A suspension imposed by the super administrator
     * can only be reversed by the super administrator.
     */
    if (
        user.suspended_by_role === 'super_admin' &&
        actorRole !== 'super_admin'
    ) {

        throw new Error(
            'Only the super administrator can reactivate a user suspended by the super administrator.'
        );
    }

    /*
     * Reactivate the user and clear the suspension actor.
     */
    const [result] = await pool.execute(
        `
        UPDATE users
        SET
            status_id = (
                SELECT id
                FROM user_statuses
                WHERE name = 'active'
                LIMIT 1
            ),
            suspended_by_user_id = NULL
        WHERE id = ?
          AND status_id = (
              SELECT id
              FROM user_statuses
              WHERE name = 'suspended'
              LIMIT 1
          )
        `,
        [userId]
    );

    if (result.affectedRows === 0) {
        throw new Error('User could not be reactivated.');
    }
}




/**
 * Reset a user's password.
 *
 * @param {number} userId
 * @param {string} newPassword
 * @returns {Promise<void>}
 */
async function resetUserPassword(userId, newPassword, actorUserId) {

   /*
 * Confirm the target user exists and determine their role.
 */
    const [users] = await pool.execute(
        `
        SELECT
            u.id,
            r.name AS role
        FROM users u
        LEFT JOIN user_roles ur
            ON ur.user_id = u.id
        LEFT JOIN roles r
            ON r.id = ur.role_id
        WHERE u.id = ?
        LIMIT 1
        `,
        [userId]
    );

    if (users.length === 0) {
        throw new Error('User not found.');
    }

    const targetRole = users[0].role;

    /*
     * Hash the new password.
     */
    const passwordHash = await bcrypt.hash(
        newPassword,
        12
    );




    /*
 * Determine the role of the user performing the reset.
 */
const [actorRoles] = await pool.execute(
    `
    SELECT
        r.name AS role
    FROM user_roles ur
    INNER JOIN roles r
        ON r.id = ur.role_id
    WHERE ur.user_id = ?
    LIMIT 1
    `,
    [actorUserId]
);

const actorRole = actorRoles.length > 0
    ? actorRoles[0].role
    : null;


    /*
 * Administrators may reset ordinary users only.
 */
    if (
        actorRole === 'administrator' &&
        (
            targetRole === 'administrator' ||
            targetRole === 'super_admin'
        )
    ) {
        if (targetRole === 'super_admin') {
            throw new Error(
                'Administrators cannot reset the super administrator password.'
            );
        }

        throw new Error(
            'Administrators cannot reset another administrator password.'
        );
    }

    /*
    * A user cannot use the administrator reset operation
    * to reset their own password.
    */

    if (Number(actorUserId) === Number(userId)) {
        throw new Error(
            'Use the change password option to change your own password.'
        );
    }



    /*
     * Update the password.
     */
    const [result] = await pool.execute(
        `
        UPDATE users
        SET
            password_hash = ?,
            session_version = session_version + 1
        WHERE id = ?
        `,
        [
            passwordHash,
            userId
        ]
    );

    if (result.affectedRows === 0) {
        throw new Error('Password could not be reset.');
    }
}



/**
 * Change the authenticated user's own password.
 */
async function changeOwnPassword(userId, currentPassword, newPassword) {

    /*
     * Confirm the user exists and retrieve the current password.
     */
    const [users] = await pool.execute(
        `
        SELECT
            id,
            password_hash
        FROM users
        WHERE id = ?
        LIMIT 1
        `,
        [userId]
    );

    if (users.length === 0) {
        throw new Error('User not found.');
    }

    const user = users[0];

    /*
     * Verify the current password.
     */
    const currentPasswordMatches = await bcrypt.compare(
        currentPassword,
        user.password_hash
    );

    if (!currentPasswordMatches) {
        throw new Error('Current password is incorrect.');
    }

    /*
     * Prevent password reuse.
     */
    const newPasswordMatches = await bcrypt.compare(
        newPassword,
        user.password_hash
    );

    if (newPasswordMatches) {
        throw new Error(
            'New password must be different from your current password.'
        );
    }

    /*
     * Hash the new password.
     */
    const passwordHash = await bcrypt.hash(
        newPassword,
        12
    );

    /*
     * Update the password and invalidate
     * previously authenticated sessions.
     */
    const [result] = await pool.execute(
        `
        UPDATE users
        SET
            password_hash = ?,
            password_changed_at = CURRENT_TIMESTAMP,
            session_version = session_version + 1
        WHERE id = ?
        `,
        [
            passwordHash,
            userId
        ]
    );

    if (result.affectedRows === 0) {
        throw new Error('Password could not be changed.');
    }

    /*
    * Retrieve the new session version.
    */

    const [updatedUsers] = await pool.execute(
        `
        SELECT
            session_version
        FROM users
        WHERE id = ?
        LIMIT 1
        `,
        [userId]
    );

    if (updatedUsers.length === 0) {
        throw new Error('Password could not be changed.');
    }

    return updatedUsers[0].session_version;



}



module.exports = {
    getAllUsers,
    getUserById,
    getOwnProfile,
    getAllRoles,
    createUser,
    createUserWithConnection,
    updateUser,
    suspendUser,
    reactivateUser,
    resetUserPassword,
    changeOwnPassword
};