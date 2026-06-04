const User = require('../models/User/User');
const UserRole = require('../models/User/UserRole');
const Role = require('../models/RolesAndPermission/Role');

const normalizeRoleName = (roleName = '') =>
  String(roleName || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');

const formatLeaveWindow = ({ fromDate, toDate }) => {
  if (!fromDate && !toDate) {
    return 'leave request';
  }

  if (fromDate && toDate) {
    return fromDate === toDate ? fromDate : `${fromDate} to ${toDate}`;
  }

  return fromDate || toDate;
};

const buildLeaveMessage = ({ requesterName, leaveType, fromDate, toDate, statusLabel }) => {
  const windowLabel = formatLeaveWindow({ fromDate, toDate });
  const base = `${requesterName || 'Employee'} submitted a ${leaveType || 'leave'} request for ${windowLabel}`;
  return statusLabel ? `${base} (${statusLabel})` : base;
};

const buildLeavePayload = ({
  leaveType,
  fromDate,
  toDate,
  description,
  attachmentUrl,
}) => ({
  leaveType: leaveType || 'Leave Request',
  fromDate: fromDate || '',
  toDate: toDate || '',
  description: description || '',
  attachmentUrl: attachmentUrl || null,
});

const getPrimaryRoleForUser = async ({ companyCode, userId }) => {
  const assignment = await UserRole.findOne({
    where: { userId },
    order: [['updatedAt', 'DESC']],
  });

  if (!assignment) {
    return null;
  }

  const role = await Role.findOne({
    where: { id: assignment.roleId, companyId: companyCode },
    attributes: ['id', 'name', 'companyId', 'parentRoleId'],
  });

  return role || null;
};

const findUserForRole = async ({ companyCode, roleName }) => {
  const normalizedRoleName = normalizeRoleName(roleName);
  if (!normalizedRoleName) {
    return null;
  }

  const role = await Role.findOne({
    where: { companyId: companyCode, name: roleName },
    attributes: ['id', 'name', 'companyId', 'parentRoleId'],
  });

  if (!role) {
    return null;
  }

  const assignment = await UserRole.findOne({
    where: { roleId: role.id },
    order: [['createdAt', 'ASC']],
  });

  if (!assignment) {
    return null;
  }

  const user = await User.findOne({
    where: { id: assignment.userId, companyCode },
    attributes: ['id', 'name', 'email', 'companyCode', 'managerId'],
  });

  return user ? user.get({ plain: true }) : null;
};

const resolveManagerTarget = async ({ companyCode, requester }) => {
  if (!requester) {
    return null;
  }

  if (requester.managerId) {
    const manager = await User.findOne({
      where: { id: requester.managerId, companyCode },
      attributes: ['id', 'name', 'email', 'companyCode'],
    });

    if (manager) {
      return { userId: manager.id, roleName: null };
    }
  }

  const primaryRole = await getPrimaryRoleForUser({ companyCode, userId: requester.id });
  if (primaryRole?.parentRoleId) {
    const parentRole = await Role.findOne({
      where: { id: primaryRole.parentRoleId, companyId: companyCode },
      attributes: ['id', 'name', 'companyId', 'parentRoleId'],
    });

    if (parentRole) {
      const parentUser = await findUserForRole({ companyCode, roleName: parentRole.name });
      if (parentUser) {
        return { userId: parentUser.id, roleName: parentRole.name };
      }

      return { userId: null, roleName: parentRole.name };
    }
  }

  const hrManager = await findUserForRole({ companyCode, roleName: 'hr_manager' });
  if (hrManager) {
    return { userId: hrManager.id, roleName: 'hr_manager' };
  }

  return { userId: null, roleName: 'hr_manager' };
};

const resolveHrTarget = async ({ companyCode }) => {
  const hrManager = await findUserForRole({ companyCode, roleName: 'hr_manager' });
  if (hrManager) {
    return { userId: hrManager.id, roleName: 'hr_manager' };
  }

  const hrUser = await findUserForRole({ companyCode, roleName: 'hr' });
  if (hrUser) {
    return { userId: hrUser.id, roleName: 'hr' };
  }

  return { userId: null, roleName: 'hr_manager' };
};

const canActOnLeaveRequest = ({ notification, req }) => {
  const currentRole = normalizeRoleName(req.userRole || req.user?.role || '');

  if (!notification) {
    return false;
  }

  if (String(notification.userId) === String(req.user?.id)) {
    return false;
  }

  if (notification.targetUserId && String(notification.targetUserId) === String(req.user?.id)) {
    return true;
  }

  if (notification.targetRole && normalizeRoleName(notification.targetRole) === currentRole) {
    return true;
  }

  return ['admin', 'sadmin'].includes(currentRole);
};

module.exports = {
  buildLeaveMessage,
  buildLeavePayload,
  canActOnLeaveRequest,
  resolveHrTarget,
  resolveManagerTarget,
};