const { Op } = require('sequelize');
const Permission = require('../models/RolesAndPermission/Permission');
const Role = require('../models/RolesAndPermission/Role');
const RolePermission = require('../models/RolesAndPermission/RolePermission');
const UserRole = require('../models/User/UserRole');
const User = require('../models/User/User');
const {
  RBAC_MODULES,
  RBAC_ACTIONS,
  ALL_DEFAULT_PERMISSION_KEYS,
  buildPermissionLabel,
} = require('../constants/rbac');

const LEGACY_PERMISSION_EXPANSIONS = {
  'user.read': ['user.view'],
  'user.manage': ['user.view', 'user.create', 'user.update', 'user.delete'],
  'project.read': ['project.view'],
  'project.manage': ['project.view', 'project.create', 'project.update', 'project.delete'],
  'task.read': ['task.view'],
  'task.manage': ['task.view', 'task.create', 'task.update', 'task.delete'],
  'settings.read': ['settings.view'],
  'settings.manage': ['settings.view', 'settings.create', 'settings.update', 'settings.delete'],
};

const LEGACY_ROLE_PERMISSIONS = {
  intern: ['project.view', 'task.view', 'update.view', 'update.create', 'chat.view', 'message.view', 'message.create'],
  employee: ['project.view', 'task.view', 'update.view', 'update.create'],
  executive: ['project.view', 'task.view', 'task.update', 'update.view', 'update.create'],
  team_lead: [
    'project.view',
    'project.update',
    'task.view',
    'task.create',
    'task.update',
    'update.view',
    'update.create',
    'update.update',
    'user.view',
  ],
  manager: [
    'project.view',
    'project.create',
    'project.update',
    'task.view',
    'task.create',
    'task.update',
    'update.view',
    'update.create',
  ],
  senior_manager: [
    'project.view',
    'project.create',
    'project.update',
    'task.view',
    'task.create',
    'task.update',
    'update.view',
    'update.create',
    'update.update',
    'user.view',
    'settings.view',
    'notification.view',
  ],
  director: [
    'project.view',
    'project.create',
    'project.update',
    'project.delete',
    'task.view',
    'task.create',
    'task.update',
    'task.delete',
    'update.view',
    'update.create',
    'update.update',
    'update.delete',
    'user.view',
    'user.update',
    'settings.view',
    'notification.view',
    'notification.update',
    'subscription.view',
  ],
  admin: [...ALL_DEFAULT_PERMISSION_KEYS],
  sadmin: [...ALL_DEFAULT_PERMISSION_KEYS],
};

const normalizePermissionKeys = (permissionKeys = []) =>
  [...new Set((permissionKeys || []).filter(Boolean).map((key) => String(key).trim()))];

const normalizeRoleName = (roleName = '') =>
  String(roleName || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');

const resolveCompanyCode = (req) => {
  if (req.userType === 'company') {
    return req.user.id;
  }
  return req.user.companyCode;
};

const ensureDefaultPermissions = async () => {
  const records = RBAC_MODULES.flatMap((moduleName) =>
    RBAC_ACTIONS.map((action) => ({
      key: `${moduleName}.${action}`,
      label: buildPermissionLabel(moduleName, action),
      description: `${action} permission for ${moduleName}`,
    }))
  );

  await Promise.all(records.map((record) => Permission.upsert(record)));
  return records;
};

const getPermissionKeysForRole = async (roleId) => {
  const rolePermissions = await RolePermission.findAll({ where: { roleId } });
  if (!rolePermissions.length) {
    return [];
  }

  const permissionIds = rolePermissions.map((entry) => entry.permissionId);
  const permissions = await Permission.findAll({
    where: { id: { [Op.in]: permissionIds } },
    attributes: ['id', 'key', 'label'],
  });

  return permissions.map((permission) => permission.key);
};

const expandLegacyPermissions = (permissionKeys = []) => {
  const set = new Set(permissionKeys);
  permissionKeys.forEach((permissionKey) => {
    const mapped = LEGACY_PERMISSION_EXPANSIONS[permissionKey] || [];
    mapped.forEach((derivedKey) => set.add(derivedKey));
  });
  return [...set];
};

const resolveUserEffectiveRole = async (user) => {
  const userRole = await UserRole.findOne({
    where: { userId: user.id },
    order: [['updatedAt', 'DESC']],
  });

  if (!userRole) {
    return null;
  }

  const role = await Role.findByPk(userRole.roleId);
  if (!role) {
    return null;
  }

  return {
    assignment: userRole,
    role,
  };
};

const resolveRoleByUserRoleName = async ({ companyCode, userRoleName }) => {
  const normalizedUserRoleName = normalizeRoleName(userRoleName);
  if (!normalizedUserRoleName) {
    return null;
  }

  const companyRoles = await Role.findAll({ where: { companyId: companyCode } });
  const matched = companyRoles.find((entry) => normalizeRoleName(entry.name) === normalizedUserRoleName);
  if (!matched) {
    return null;
  }

  return {
    assignment: null,
    role: matched,
  };
};

const getEffectivePermissions = async (req) => {
  const companyCode = resolveCompanyCode(req);

  if (!companyCode) {
    return {
      companyCode: null,
      role: null,
      permissionKeys: [],
      isAllAccess: false,
    };
  }

  if (req.userType === 'company') {
    return {
      companyCode,
      role: { id: null, name: req.userRole || 'admin', isSystem: true },
      permissionKeys: [...ALL_DEFAULT_PERMISSION_KEYS],
      isAllAccess: true,
    };
  }

  const mappedRole = await resolveUserEffectiveRole(req.user);

  const resolvedRole =
    mappedRole && mappedRole.role.companyId === companyCode
      ? mappedRole
      : await resolveRoleByUserRoleName({
          companyCode,
          userRoleName: req.userRole,
        });

  if (resolvedRole && resolvedRole.role && resolvedRole.role.companyId === companyCode) {
    const rawKeys = await getPermissionKeysForRole(resolvedRole.role.id);
    const permissionKeys = expandLegacyPermissions(normalizePermissionKeys(rawKeys));

    return {
      companyCode,
      role: resolvedRole.role,
      permissionKeys,
      isAllAccess: false,
    };
  }

  // Strict fallback: deny when no company-scoped RBAC role mapping exists.
  return {
    companyCode,
    role: { id: null, name: req.userRole || 'unauthorized', isSystem: true },
    permissionKeys: [],
    isAllAccess: false,
  };
};

const canAccessPermission = (effectivePermissions, requiredPermission) => {
  if (!requiredPermission) {
    return true;
  }

  if (effectivePermissions.isAllAccess) {
    return true;
  }

  const permissionSet = new Set(effectivePermissions.permissionKeys || []);
  if (permissionSet.has(requiredPermission)) {
    return true;
  }

  const [moduleName, action] = requiredPermission.split('.');
  if (!moduleName || !action) {
    return false;
  }

  if (permissionSet.has(`${moduleName}.manage`)) {
    return true;
  }

  if (action === 'view' && permissionSet.has(`${moduleName}.read`)) {
    return true;
  }

  if (['create', 'update', 'delete'].includes(action) && permissionSet.has(`${moduleName}.write`)) {
    return true;
  }

  return false;
};

const ensureRoleExistsForCompany = async ({ companyCode, roleId }) => {
  const role = await Role.findByPk(roleId);
  if (!role || role.companyId !== companyCode) {
    return null;
  }
  return role;
};

const upsertPermissionsByKeys = async (permissionKeys = []) => {
  const normalizedKeys = normalizePermissionKeys(permissionKeys);
  if (!normalizedKeys.length) {
    return [];
  }

  await Promise.all(
    normalizedKeys.map((key) =>
      Permission.upsert({
        key,
        label: buildPermissionLabel(key.split('.')[0] || 'custom', key.split('.')[1] || 'view'),
      })
    )
  );

  return Permission.findAll({ where: { key: { [Op.in]: normalizedKeys } } });
};

const replaceRolePermissions = async ({ roleId, permissionKeys, transaction }) => {
  const permissionRecords = await upsertPermissionsByKeys(permissionKeys);
  const permissionIds = permissionRecords.map((permission) => permission.id);

  await RolePermission.destroy({ where: { roleId }, transaction });

  if (!permissionIds.length) {
    return [];
  }

  await RolePermission.bulkCreate(
    permissionIds.map((permissionId) => ({ roleId, permissionId })),
    { transaction }
  );

  return permissionRecords;
};

const seedSystemRolesForCompany = async (companyCode) => {
  // Roles and hierarchy are now DB-driven from frontend.
  // Keep permission catalog seeded, but do not auto-create system roles.
  await ensureDefaultPermissions();
};

const createSAdminRoleForCompany = async (companyCode) => {
  try {
    // Ensure default permissions exist
    await ensureDefaultPermissions();

    // Check if sAdmin role already exists
    const existingSAdmin = await Role.findOne({
      where: { companyId: companyCode, name: 'sAdmin' }
    });

    if (existingSAdmin) {
      return existingSAdmin;
    }

    // Get all permission IDs
    const permissions = await Permission.findAll({
      attributes: ['id']
    });

    // Create sAdmin role with isSystem=true to mark it as protected
    const sAdminRole = await Role.create({
      companyId: companyCode,
      name: 'sAdmin',
      isSystem: true,
      isCustom: false,
      parentRoleId: null,
    });

    // Assign all permissions to sAdmin
    const permissionIds = permissions.map((p) => p.id);
    await RolePermission.bulkCreate(
      permissionIds.map((permissionId) => ({ roleId: sAdminRole.id, permissionId }))
    );

    console.log(`✅ Created sAdmin role for company ${companyCode} with ${permissionIds.length} permissions`);
    return sAdminRole;
  } catch (error) {
    console.error('Error creating sAdmin role:', error.message);
    throw error;
  }
};

const buildRoleHierarchyTree = (roles = []) => {
  const nodeMap = new Map();
  roles.forEach((role) => {
    nodeMap.set(role.id, {
      ...role,
      id: role.id,
      name: role.name,
      isSystem: role.isSystem,
      isCustom: role.isCustom,
      parentRoleId: role.parentRoleId || null,
      membersCount: role.membersCount || 0,
      children: [],
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    });
  });

  const roots = [];
  nodeMap.forEach((node) => {
    if (node.parentRoleId && nodeMap.has(node.parentRoleId)) {
      nodeMap.get(node.parentRoleId).children.push(node);
      return;
    }
    roots.push(node);
  });

  return roots;
};

const ensureUserRoleAssignment = async ({ userId, roleId, transaction }) => {
  const existing = await UserRole.findOne({ where: { userId }, transaction });
  if (existing) {
    await existing.update({ roleId }, { transaction });
    // Mark user as approved when role is assigned/updated
    try {
      await User.update({ approved: true }, { where: { id: userId }, transaction });
    } catch (e) {
      console.warn('Failed to mark user approved after role update:', e.message);
    }
    return existing;
  }

  const created = await UserRole.create({ userId, roleId }, { transaction });
  // Mark user as approved when role is assigned
  try {
    await User.update({ approved: true }, { where: { id: userId }, transaction });
  } catch (e) {
    console.warn('Failed to mark user approved after role assignment:', e.message);
  }
  return created;
};

const getRolePermissionDetails = async (roleId) => {
  const rolePermissions = await RolePermission.findAll({ where: { roleId } });
  if (!rolePermissions.length) {
    return [];
  }

  const permissionIds = rolePermissions.map((entry) => entry.permissionId);
  return Permission.findAll({
    where: { id: { [Op.in]: permissionIds } },
    attributes: ['id', 'key', 'label', 'description'],
    order: [['key', 'ASC']],
  });
};

module.exports = {
  canAccessPermission,
  createSAdminRoleForCompany,
  ensureDefaultPermissions,
  ensureRoleExistsForCompany,
  ensureUserRoleAssignment,
  getEffectivePermissions,
  getRolePermissionDetails,
  normalizePermissionKeys,
  replaceRolePermissions,
  resolveCompanyCode,
  seedSystemRolesForCompany,
  buildRoleHierarchyTree,
  upsertPermissionsByKeys,
  ALL_DEFAULT_PERMISSION_KEYS,
};
