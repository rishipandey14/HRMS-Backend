const { Op } = require('sequelize');
const { seq } = require('../config/db');
const Role = require('../models/RolesAndPermission/Role');
const Permission = require('../models/RolesAndPermission/Permission');
const User = require('../models/User/User');
const UserRole = require('../models/User/UserRole');
const {
  buildRoleHierarchyTree,
  ensureDefaultPermissions,
  ensureRoleExistsForCompany,
  ensureUserRoleAssignment,
  getEffectivePermissions,
  getRolePermissionDetails,
  normalizePermissionKeys,
  replaceRolePermissions,
  resolveCompanyCode,
  seedSystemRolesForCompany,
} = require('../services/rbacService');

const ensureCompanyContext = (req, res) => {
  const companyCode = resolveCompanyCode(req);
  if (!companyCode) {
    res.status(400).json({ msg: 'Company context not found' });
    return null;
  }
  return companyCode;
};

const listPermissions = async (req, res) => {
  try {
    await ensureDefaultPermissions();
    const permissions = await Permission.findAll({
      attributes: ['id', 'key', 'label', 'description'],
      order: [['key', 'ASC']],
    });

    return res.json({
      total: permissions.length,
      permissions,
    });
  } catch (error) {
    console.error('listPermissions error:', error);
    return res.status(500).json({ msg: 'Failed to load permissions' });
  }
};

const listRoles = async (req, res) => {
  try {
    const companyCode = ensureCompanyContext(req, res);
    if (!companyCode) {
      return;
    }

    await seedSystemRolesForCompany(companyCode);

    const roles = await Role.findAll({
      where: { companyId: companyCode },
      order: [['isSystem', 'DESC'], ['name', 'ASC']],
    });

    const roleIds = roles.map((role) => role.id);
    const assignments = roleIds.length
      ? await UserRole.findAll({
          where: { roleId: { [Op.in]: roleIds } },
          attributes: ['roleId', 'userId'],
        })
      : [];

    const assignedCountByRoleId = assignments.reduce((acc, row) => {
      acc[row.roleId] = (acc[row.roleId] || 0) + 1;
      return acc;
    }, {});

    const enriched = await Promise.all(
      roles.map(async (role) => {
        const permissions = await getRolePermissionDetails(role.id);
        return {
          ...role.toJSON(),
          assignedUsersCount: assignedCountByRoleId[role.id] || 0,
          permissions,
        };
      })
    );

    return res.json({
      total: enriched.length,
      roles: enriched,
    });
  } catch (error) {
    console.error('listRoles error:', error);
    return res.status(500).json({ msg: 'Failed to load roles' });
  }
};

const getRoleTree = async (req, res) => {
  try {
    const companyCode = ensureCompanyContext(req, res);
    if (!companyCode) {
      return;
    }

    const roles = await Role.findAll({
      where: { companyId: companyCode },
      order: [['name', 'ASC']],
    });

    const roleIds = roles.map((role) => role.id);
    const assignments = roleIds.length
      ? await UserRole.findAll({
          where: { roleId: { [Op.in]: roleIds } },
          attributes: ['roleId', 'userId'],
        })
      : [];

    const assignmentCounts = assignments.reduce((acc, entry) => {
      acc[entry.roleId] = (acc[entry.roleId] || 0) + 1;
      return acc;
    }, {});

    const tree = buildRoleHierarchyTree(
      roles.map((role) => ({
        ...role.toJSON(),
        membersCount: assignmentCounts[role.id] || 0,
      }))
    );

    return res.json({ tree });
  } catch (error) {
    console.error('getRoleTree error:', error);
    return res.status(500).json({ msg: 'Failed to build role tree' });
  }
};

const getOrgChart = async (req, res) => {
  try {
    const companyCode = ensureCompanyContext(req, res);
    if (!companyCode) {
      return;
    }

    // Fetch all roles for the company with their hierarchy
    const roles = await Role.findAll({
      where: { companyId: companyCode },
      attributes: ['id', 'name', 'parentRoleId', 'isSystem'],
      order: [['name', 'ASC']],
    });

    // Fetch all users with their role assignments
    const users = await User.findAll({
      where: { companyCode: companyCode },
      attributes: ['id', 'name', 'email', 'companyCode'],
      include: [{
        association: 'rbacRoles',
        attributes: ['id', 'name', 'parentRoleId'],
        through: { attributes: [] },
      }],
    });

    // Build role hierarchy tree with users
    const buildRoleTree = (roles, parentId = null) => {
      return roles
        .filter(role => role.parentRoleId === parentId)
        .map(role => {
          // Find all users assigned to this role
          const usersInRole = users
            .filter(user => user.rbacRoles && user.rbacRoles.length > 0 && user.rbacRoles[0].id === role.id)
            .map(user => ({
              userId: user.id,
              name: user.name || user.email,
              email: user.email,
              roleId: role.id,
              roleName: role.name,
            }));

          const children = buildRoleTree(roles, role.id);

          // Only include roles that have users or have children with users
          if (usersInRole.length === 0 && children.length === 0) {
            return null;
          }

          return {
            id: role.id,
            name: role.name,
            isSystem: role.isSystem,
            parentRoleId: role.parentRoleId,
            users: usersInRole,
            userCount: usersInRole.length,
            children: children,
          };
        })
        .filter(node => node !== null); // Remove roles with no users
    };

    const tree = buildRoleTree(roles);

    // Find unassigned users
    const unassignedUsers = users
      .filter(user => !user.rbacRoles || user.rbacRoles.length === 0)
      .map(user => ({
        userId: user.id,
        name: user.name || user.email,
        email: user.email,
        roleId: null,
        roleName: 'Unassigned',
      }));

    return res.json({ 
      tree,
      unassignedUsers,
      totalUsers: users.length,
      totalRoles: roles.length,
    });
  } catch (error) {
    console.error('getOrgChart error:', error);
    return res.status(500).json({ msg: 'Failed to load org chart' });
  }
};

const createRole = async (req, res) => {
  const transaction = await seq.transaction();
  try {
    const companyCode = ensureCompanyContext(req, res);
    if (!companyCode) {
      await transaction.rollback();
      return;
    }

    const { name, permissionKeys = [], parentRoleId = null } = req.body || {};

    if (!name || !String(name).trim()) {
      await transaction.rollback();
      return res.status(400).json({ msg: 'Role name is required' });
    }

    const roleName = String(name).trim();
    const existing = await Role.findOne({
      where: {
        companyId: companyCode,
        name: roleName,
      },
      transaction,
    });

    if (existing) {
      await transaction.rollback();
      return res.status(409).json({ msg: 'Role with this name already exists' });
    }

    if (parentRoleId) {
      const parentRole = await ensureRoleExistsForCompany({ companyCode, roleId: parentRoleId });
      if (!parentRole) {
        await transaction.rollback();
        return res.status(400).json({ msg: 'Invalid parent role for this company' });
      }
    }

    const role = await Role.create(
      {
        companyId: companyCode,
        name: roleName,
        isSystem: false,
        isCustom: true,
        parentRoleId,
      },
      { transaction }
    );

    await replaceRolePermissions({
      roleId: role.id,
      permissionKeys: normalizePermissionKeys(permissionKeys),
      transaction,
    });

    await transaction.commit();

    const permissions = await getRolePermissionDetails(role.id);
    return res.status(201).json({
      msg: 'Role created successfully',
      role: {
        ...role.toJSON(),
        permissions,
      },
    });
  } catch (error) {
    await transaction.rollback();
    console.error('createRole error:', error);
    return res.status(500).json({ msg: 'Failed to create role' });
  }
};

const updateRolePermissions = async (req, res) => {
  const transaction = await seq.transaction();
  try {
    const companyCode = ensureCompanyContext(req, res);
    if (!companyCode) {
      await transaction.rollback();
      return;
    }

    const { roleId } = req.params;
    const { permissionKeys = [] } = req.body || {};

    const role = await ensureRoleExistsForCompany({ companyCode, roleId });
    if (!role) {
      await transaction.rollback();
      return res.status(404).json({ msg: 'Role not found' });
    }

    // Prevent modification of system roles (sAdmin)
    if (role.isSystem && role.name === 'sAdmin') {
      await transaction.rollback();
      return res.status(403).json({ msg: 'Cannot modify sAdmin role permissions' });
    }

    await replaceRolePermissions({
      roleId: role.id,
      permissionKeys: normalizePermissionKeys(permissionKeys),
      transaction,
    });

    await transaction.commit();

    const permissions = await getRolePermissionDetails(role.id);
    return res.json({
      msg: 'Role permissions updated',
      role: {
        ...role.toJSON(),
        permissions,
      },
    });
  } catch (error) {
    await transaction.rollback();
    console.error('updateRolePermissions error:', error);
    return res.status(500).json({ msg: 'Failed to update role permissions' });
  }
};

const updateRoleParent = async (req, res) => {
  try {
    const companyCode = ensureCompanyContext(req, res);
    if (!companyCode) {
      return;
    }

    const { roleId } = req.params;
    const { parentRoleId = null } = req.body || {};
    const normalizedParentRoleId = parentRoleId || null;

    const role = await ensureRoleExistsForCompany({ companyCode, roleId });
    if (!role) {
      return res.status(404).json({ msg: 'Role not found' });
    }

    if (normalizedParentRoleId) {
      if (String(normalizedParentRoleId) === String(role.id)) {
        return res.status(400).json({ msg: 'Role cannot be parent of itself' });
      }

      const parentRole = await ensureRoleExistsForCompany({ companyCode, roleId: normalizedParentRoleId });
      if (!parentRole) {
        return res.status(400).json({ msg: 'Parent role not found in this company' });
      }

      // Prevent cyclic hierarchy: new parent cannot be inside this role's own subtree.
      const companyRoles = await Role.findAll({
        where: { companyId: companyCode },
        attributes: ['id', 'parentRoleId'],
      });

      const roleMap = new Map(companyRoles.map((entry) => [String(entry.id), entry]));
      const visited = new Set();
      let currentRoleId = String(parentRole.id);

      while (currentRoleId) {
        if (currentRoleId === String(role.id)) {
          return res.status(400).json({ msg: 'Invalid parent role: hierarchy cycle detected' });
        }

        if (visited.has(currentRoleId)) {
          return res.status(400).json({ msg: 'Invalid role hierarchy: cycle exists in current data' });
        }

        visited.add(currentRoleId);
        const currentRole = roleMap.get(currentRoleId);
        if (!currentRole || !currentRole.parentRoleId) {
          break;
        }

        currentRoleId = String(currentRole.parentRoleId);
      }
    }

    await role.update({ parentRoleId: normalizedParentRoleId });

    return res.json({
      msg: 'Role hierarchy updated',
      role,
    });
  } catch (error) {
    console.error('updateRoleParent error:', error);
    return res.status(500).json({ msg: 'Failed to update role hierarchy' });
  }
};

const assignUserRole = async (req, res) => {
  const transaction = await seq.transaction();
  try {
    const companyCode = ensureCompanyContext(req, res);
    if (!companyCode) {
      await transaction.rollback();
      return;
    }

    const { userId } = req.params;
    const { roleId } = req.body || {};

    if (!roleId) {
      await transaction.rollback();
      return res.status(400).json({ msg: 'roleId is required' });
    }

    const role = await ensureRoleExistsForCompany({ companyCode, roleId });
    if (!role) {
      await transaction.rollback();
      return res.status(404).json({ msg: 'Role not found for this company' });
    }

    const user = await User.findByPk(userId, { transaction });
    if (!user || user.companyCode !== companyCode) {
      await transaction.rollback();
      return res.status(404).json({ msg: 'User not found in this company' });
    }

    await ensureUserRoleAssignment({ userId: user.id, roleId: role.id, transaction });

    await transaction.commit();

    return res.json({
      msg: 'User role assigned successfully',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: role.name,
        roleId: role.id,
      },
    });
  } catch (error) {
    await transaction.rollback();
    console.error('assignUserRole error:', error);
    return res.status(500).json({ msg: 'Failed to assign role to user' });
  }
};

const getMeRbac = async (req, res) => {
  try {
    const effective = await getEffectivePermissions(req);

    return res.json({
      companyCode: effective.companyCode,
      role: effective.role,
      permissions: effective.permissionKeys,
      isAllAccess: effective.isAllAccess,
    });
  } catch (error) {
    console.error('getMeRbac error:', error);
    return res.status(500).json({ msg: 'Failed to fetch RBAC details' });
  }
};

module.exports = {
  assignUserRole,
  createRole,
  getMeRbac,
  getOrgChart,
  getRoleTree,
  listPermissions,
  listRoles,
  updateRoleParent,
  updateRolePermissions,
};
