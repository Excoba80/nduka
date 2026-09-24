START TRANSACTION;

-- ============================================================
-- NDUKA RBAC — Initial Role Permissions
-- ============================================================

-- SUPER ADMIN
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'super_admin'
  AND p.name IN (
      'create_user',
      'view_user',
      'update_user',
      'suspend_user',
      'reactivate_user',
      'reset_user_password'
  )
  AND NOT EXISTS (
      SELECT 1
      FROM role_permissions rp
      WHERE rp.role_id = r.id
        AND rp.permission_id = p.id
  );

-- ADMINISTRATOR
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'administrator'
  AND p.name IN (
      'create_user',
      'view_user',
      'update_user',
      'suspend_user',
      'reactivate_user',
      'reset_user_password'
  )
  AND NOT EXISTS (
      SELECT 1
      FROM role_permissions rp
      WHERE rp.role_id = r.id
        AND rp.permission_id = p.id
  );

COMMIT;
