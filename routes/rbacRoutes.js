const express = require('express');
const router = express.Router();

const authMiddleware = require('../middleware/authMiddleware');
const { requireCompanyAdmin } = require('../middleware/rbacMiddleware');
const {
  assignUserRole,
  createRole,
  getMeRbac,
  getOrgChart,
  getRoleTree,
  listPermissions,
  listRoles,
  updateRoleParent,
  updateRolePermissions,
} = require('../controllers/rbacController');

router.use(authMiddleware);

router.get('/me', getMeRbac);
router.get('/permissions', requireCompanyAdmin, listPermissions);
router.get('/roles', requireCompanyAdmin, listRoles);
router.get('/roles/tree', requireCompanyAdmin, getRoleTree);
router.get('/orgchart', requireCompanyAdmin, getOrgChart);

router.post('/roles', requireCompanyAdmin, createRole);
router.patch('/roles/:roleId/permissions', requireCompanyAdmin, updateRolePermissions);
router.patch('/roles/:roleId/parent', requireCompanyAdmin, updateRoleParent);
router.patch('/users/:userId/role', requireCompanyAdmin, assignUserRole);

module.exports = router;
