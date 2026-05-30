const {
  canAccessPermission,
  getEffectivePermissions,
} = require('../services/rbacService');

const requireCompanyAdmin = async (req, res, next) => {
  try {
    const resolvedRole = String(req.userRole || req.user?.role || '').toLowerCase();
    if (['admin', 'sadmin'].includes(resolvedRole)) {
      return next();
    }

    if (req.userType === 'company') {
      return next();
    }

    const effective = await getEffectivePermissions(req);
    req.rbac = effective;

    if (effective.isAllAccess) {
      return next();
    }

    if (canAccessPermission(effective, 'role.update')) {
      return next();
    }

    return res.status(403).json({ msg: 'Only company admins can perform this action' });
  } catch (error) {
    console.error('requireCompanyAdmin error:', error.message);
    return res.status(500).json({ msg: 'Authorization error' });
  }
};

const requirePermission = (permissionKey) => {
  return async (req, res, next) => {
    try {
      const effective = req.rbac || (await getEffectivePermissions(req));
      req.rbac = effective;

      if (canAccessPermission(effective, permissionKey)) {
        return next();
      }

      return res.status(403).json({ msg: `Permission denied: ${permissionKey}` });
    } catch (error) {
      console.error('requirePermission error:', error.message);
      return res.status(500).json({ msg: 'Authorization error' });
    }
  };
};

module.exports = {
  requireCompanyAdmin,
  requirePermission,
};
