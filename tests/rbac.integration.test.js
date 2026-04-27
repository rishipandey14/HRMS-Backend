const express = require('express');
const request = require('supertest');

jest.mock('../middleware/authMiddleware', () => {
  return (req, res, next) => {
    req.userType = 'company';
    req.user = {
      id: '123456',
      role: 'admin',
      companyCode: '123456',
      email: 'admin@company.com',
    };
    req.userRole = 'admin';
    next();
  };
});

jest.mock('../config/db', () => ({
  seq: {
    transaction: jest.fn().mockResolvedValue({
      commit: jest.fn().mockResolvedValue(true),
      rollback: jest.fn().mockResolvedValue(true),
    }),
  },
}));

jest.mock('../models/RolesAndPermission/Role', () => ({
  findOne: jest.fn(),
  create: jest.fn(),
  findByPk: jest.fn(),
  findAll: jest.fn().mockResolvedValue([]),
}));

jest.mock('../models/RolesAndPermission/Permission', () => ({
  findAll: jest.fn().mockResolvedValue([]),
}));

jest.mock('../models/User/User', () => ({
  findByPk: jest.fn(),
}));

jest.mock('../models/User/UserRole', () => ({
  findAll: jest.fn().mockResolvedValue([]),
}));

jest.mock('../services/rbacService', () => ({
  buildRoleHierarchyTree: jest.fn().mockReturnValue([]),
  ensureDefaultPermissions: jest.fn().mockResolvedValue([]),
  ensureRoleExistsForCompany: jest.fn(),
  ensureUserRoleAssignment: jest.fn().mockResolvedValue({}),
  getEffectivePermissions: jest.fn().mockResolvedValue({
    companyCode: '123456',
    role: { id: 1, name: 'admin' },
    permissionKeys: ['role.update', 'project.view', 'project.create'],
    isAllAccess: false,
  }),
  getRolePermissionDetails: jest.fn().mockResolvedValue([]),
  normalizePermissionKeys: jest.fn((keys) => keys || []),
  replaceRolePermissions: jest.fn().mockResolvedValue([]),
  resolveCompanyCode: jest.fn((req) => req.user?.companyCode || req.user?.id),
  seedSystemRolesForCompany: jest.fn().mockResolvedValue(true),
  upsertPermissionsByKeys: jest.fn().mockResolvedValue([]),
  canAccessPermission: jest.fn((effective, required) => {
    if (effective.isAllAccess) return true;
    return (effective.permissionKeys || []).includes(required);
  }),
}));

const Role = require('../models/RolesAndPermission/Role');
const User = require('../models/User/User');
const rbacService = require('../services/rbacService');
const rbacRoutes = require('../routes/rbacRoutes');
const { requirePermission } = require('../middleware/rbacMiddleware');

const buildTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/rbac', rbacRoutes);
  return app;
};

describe('RBAC API integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('creates a role successfully', async () => {
    Role.findOne.mockResolvedValue(null);
    Role.create.mockResolvedValue({
      id: 10,
      name: 'senior_manager',
      companyId: '123456',
      isSystem: false,
      isCustom: true,
      parentRoleId: null,
      toJSON() {
        return {
          id: this.id,
          name: this.name,
          companyId: this.companyId,
          isSystem: this.isSystem,
          isCustom: this.isCustom,
          parentRoleId: this.parentRoleId,
        };
      },
    });

    const app = buildTestApp();
    const response = await request(app)
      .post('/api/rbac/roles')
      .send({
        name: 'senior_manager',
        permissionKeys: ['project.view', 'project.update'],
      });

    expect(response.status).toBe(201);
    expect(response.body.role.name).toBe('senior_manager');
    expect(rbacService.replaceRolePermissions).toHaveBeenCalled();
  });

  test('updates role permissions', async () => {
    rbacService.ensureRoleExistsForCompany.mockResolvedValue({
      id: 11,
      name: 'manager',
      companyId: '123456',
      toJSON() {
        return { id: 11, name: 'manager', companyId: '123456' };
      },
    });

    const app = buildTestApp();
    const response = await request(app)
      .patch('/api/rbac/roles/11/permissions')
      .send({ permissionKeys: ['task.view', 'task.update'] });

    expect(response.status).toBe(200);
    expect(response.body.msg).toMatch(/updated/i);
    expect(rbacService.replaceRolePermissions).toHaveBeenCalledWith(
      expect.objectContaining({ roleId: 11 })
    );
  });

  test('assigns a role to user successfully', async () => {
    rbacService.ensureRoleExistsForCompany.mockResolvedValue({ id: 12, name: 'employee', companyId: '123456' });

    const update = jest.fn().mockResolvedValue(true);
    User.findByPk.mockResolvedValue({
      id: 55,
      companyCode: '123456',
      name: 'John',
      email: 'john@company.com',
      update,
    });

    const app = buildTestApp();
    const response = await request(app)
      .patch('/api/rbac/users/55/role')
      .send({ roleId: 12 });

    expect(response.status).toBe(200);
    expect(response.body.user.role).toBe('employee');
    expect(rbacService.ensureUserRoleAssignment).toHaveBeenCalled();
  });
});

describe('Permission middleware allow and deny behavior', () => {
  test('allows when permission exists', async () => {
    rbacService.getEffectivePermissions.mockResolvedValue({
      companyCode: '123456',
      permissionKeys: ['project.view'],
      isAllAccess: false,
    });
    rbacService.canAccessPermission.mockReturnValue(true);

    const app = express();
    app.get('/ok', (req, res, next) => {
      req.userType = 'user';
      req.user = { id: 1, companyCode: '123456', role: 'employee' };
      next();
    }, requirePermission('project.view'), (req, res) => {
      res.json({ ok: true });
    });

    const response = await request(app).get('/ok');
    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
  });

  test('denies when permission missing', async () => {
    rbacService.getEffectivePermissions.mockResolvedValue({
      companyCode: '123456',
      permissionKeys: ['task.view'],
      isAllAccess: false,
    });
    rbacService.canAccessPermission.mockReturnValue(false);

    const app = express();
    app.get('/deny', (req, res, next) => {
      req.userType = 'user';
      req.user = { id: 1, companyCode: '123456', role: 'employee' };
      next();
    }, requirePermission('project.view'), (req, res) => {
      res.json({ ok: true });
    });

    const response = await request(app).get('/deny');
    expect(response.status).toBe(403);
    expect(response.body.msg).toMatch(/permission denied/i);
  });
});
