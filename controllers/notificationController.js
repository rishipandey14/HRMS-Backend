const Notification = require('../models/Others/Notification');
const { Op } = require('sequelize');
const { collectHierarchyUserIds } = require('../services/notificationHierarchyService');
const {
  addClient,
  removeClient,
  publishNotificationToAdmin,
  publishNotificationToRoles,
  publishNotificationToUsers,
  writeEvent,
} = require('../services/notificationSseService');
const {
  buildLeaveMessage,
  buildLeavePayload,
  canActOnLeaveRequest,
  resolveHrTarget,
  resolveManagerTarget,
} = require('../services/leaveWorkflowService');

const normalizeRoleName = (roleName = '') =>
  String(roleName || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');

const arrayIncludesId = (values, id) => {
  if (!Array.isArray(values)) return false;
  return values.map((value) => String(value)).includes(String(id));
};

const arrayIncludesRole = (values, roleName) => {
  if (!Array.isArray(values)) return false;
  const normalized = normalizeRoleName(roleName);
  return values.map((value) => normalizeRoleName(value)).includes(normalized);
};

const canViewNotification = (notification, req) => {
  const currentUserId = req.user?.id;
  const currentRole = normalizeRoleName(req.userRole || req.user?.role || '');

  if (!notification) return false;
  if (String(notification.userId) === String(currentUserId)) return true;
  if (String(notification.targetUserId || '') === String(currentUserId)) return true;
  if (arrayIncludesId(notification.visibleUserIds, currentUserId)) return true;
  if (notification.targetRole && normalizeRoleName(notification.targetRole) === currentRole) return true;
  if (arrayIncludesRole(notification.visibleRoleNames, currentRole)) return true;

  if (['admin', 'sadmin'].includes(currentRole)) {
    if (notification.type === 'user_approval') return true;
    if (notification.type === 'file_upload') return true;
  }

  return false;
};

const mergeUserIds = (...lists) => {
  const merged = [];
  lists.flat().forEach((value) => {
    if (value === null || value === undefined || value === '') return;
    const normalized = String(value);
    if (!merged.includes(normalized)) merged.push(normalized);
  });
  return merged.length ? merged : null;
};

// Get notifications for a company (admin)
const getNotifications = async (req, res) => {
  try {
    // For Company users, use id as companyCode; for regular users, use companyCode
    const companyCode = req.user.companyCode || req.user.id;
    const { type, status } = req.query;
    const where = { companyCode };
    if (type) where.type = type;
    if (status) where.status = status;

    if (type === 'leave_request') {
      where[require('sequelize').Op.or] = [
        { userId: req.user.id },
        { targetUserId: req.user.id },
        { targetRole: req.userRole || req.user?.role || null },
      ];
    }

    const notifications = await Notification.findAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: 50
    });

    const visibleNotifications = notifications.filter((notification) => canViewNotification(notification.get({ plain: true }), req));

    res.json({ notifications: visibleNotifications });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};

const streamNotifications = async (req, res) => {
  try {
    const companyCode = req.user.companyCode || req.user.id;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    res.flushHeaders?.();
    res.write('retry: 5000\n\n');

    // Register connection both for the user's id and their role so they receive targeted and role-based events
    const streamRole = req.userRole || req.user?.role || 'user';
    const clientKeys = addClient({ companyCode, role: streamRole, userId: req.user.id, res });
    writeEvent(res, 'notification.connected', { ok: true, companyCode });

    const heartbeat = setInterval(() => {
      res.write(': keep-alive\n\n');
    }, 25000);

    req.on('close', () => {
      clearInterval(heartbeat);
      removeClient({ key: clientKeys, res });
      res.end();
    });
  } catch (error) {
    console.error('Stream notifications error:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};

// Mark notification as read
const markAsRead = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const companyCode = req.user.companyCode || req.user.id;

    const notification = await Notification.findOne({ where: { id: notificationId, companyCode } });

    if (!notification) {
      return res.status(404).json({ msg: 'Notification not found' });
    }

    if (!canViewNotification(notification.get({ plain: true }), req)) {
      return res.status(403).json({ msg: 'Notification not available to this user' });
    }

    notification.isRead = true;
    await notification.save();

    const payload = notification.get({ plain: true });
    if (payload.targetUserId) {
      await publishNotificationToUsers({
        companyCode,
        event: 'notification.updated',
        notification: payload,
        userIds: [payload.targetUserId],
      });
    }
    if (payload.targetRole) {
      publishNotificationToRoles({
        companyCode,
        event: 'notification.updated',
        notification: payload,
        roles: [payload.targetRole],
      });
    }

    res.json({ notification });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};

const decideRequestNotification = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const { action } = req.body || {};
    const companyCode = req.user.companyCode || req.user.id;

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ msg: 'Invalid action' });
    }

    const notification = await Notification.findOne({ where: { id: notificationId, companyCode } });

    if (!notification) {
      return res.status(404).json({ msg: 'Notification not found' });
    }

    if (!canViewNotification(notification.get({ plain: true }), req)) {
      return res.status(403).json({ msg: 'Notification not available to this user' });
    }

    if (notification.type === 'leave_request' && !canActOnLeaveRequest({ notification, req })) {
      return res.status(403).json({ msg: 'You are not allowed to review this leave request' });
    }

    if (!['leave_request', 'regularization_request'].includes(notification.type)) {
      return res.status(400).json({ msg: 'This notification cannot be approved or rejected' });
    }

    const eventName = 'notification.updated';
    const requesterId = notification.userId;
    const requesterName = notification.userName || 'Employee';
    const payload = notification.payload || {};
    const rejectionReason = String(req.body?.reason || req.body?.rejectionReason || '').trim();

    if (notification.type === 'leave_request') {
      const currentStage = String(notification.status || 'pending_manager');
      if (currentStage === 'pending_manager') {
        if (action === 'reject') {
          if (!rejectionReason) {
            return res.status(400).json({ msg: 'Rejection reason is required' });
          }

          notification.status = 'rejected';
          notification.workflowStage = 'final';
          notification.decisionBy = req.user.id;
          notification.decisionReason = rejectionReason;
          notification.targetUserId = requesterId;
          notification.targetRole = null;
          notification.visibleUserIds = mergeUserIds([requesterId]);
          notification.visibleRoleNames = null;
          notification.message = `${requesterName}'s leave request was rejected by the reporting manager`;
        } else {
          const hrTarget = await resolveHrTarget({ companyCode });
          notification.status = 'pending_hr';
          notification.workflowStage = 'hr_review';
          notification.decisionBy = req.user.id;
          notification.decisionReason = null;
          notification.targetUserId = hrTarget.userId || null;
          notification.targetRole = hrTarget.userId ? null : hrTarget.roleName;
          notification.visibleUserIds = mergeUserIds([requesterId, hrTarget.userId]);
          notification.visibleRoleNames = hrTarget.userId ? null : [hrTarget.roleName];
          notification.message = `${requesterName}'s leave request is waiting for HR final approval`;
        }
      } else if (currentStage === 'pending_hr') {
        if (action === 'reject') {
          if (!rejectionReason) {
            return res.status(400).json({ msg: 'Rejection reason is required' });
          }
          notification.status = 'rejected';
          notification.workflowStage = 'final';
          notification.decisionBy = req.user.id;
          notification.decisionReason = rejectionReason;
          notification.targetUserId = requesterId;
          notification.targetRole = null;
          notification.visibleUserIds = mergeUserIds([requesterId]);
          notification.visibleRoleNames = null;
          notification.message = `${requesterName}'s leave request was rejected by HR`;
        } else {
          notification.status = 'approved';
          notification.workflowStage = 'final';
          notification.decisionBy = req.user.id;
          notification.decisionReason = null;
          notification.targetUserId = requesterId;
          notification.targetRole = null;
          notification.visibleUserIds = mergeUserIds([requesterId]);
          notification.visibleRoleNames = null;
          notification.message = `${requesterName}'s leave request was approved by HR`;
        }
      } else {
        return res.status(400).json({ msg: 'This leave request is no longer pending review' });
      }

      notification.isRead = true;
      notification.payload = {
        ...payload,
        managerDecisionBy: notification.workflowStage === 'hr_review' ? req.user.id : notification.decisionBy,
        decisionReason: notification.decisionReason,
        workflowStage: notification.workflowStage,
        status: notification.status,
      };
      await notification.save();

      const savedPayload = notification.get({ plain: true });
      if (savedPayload.userId) {
        await publishNotificationToUsers({
          companyCode,
          event: eventName,
          notification: savedPayload,
          userIds: [savedPayload.userId],
        });
      }

      if (savedPayload.targetUserId) {
        await publishNotificationToUsers({
          companyCode,
          event: eventName,
          notification: savedPayload,
          userIds: [savedPayload.targetUserId],
        });
      }

      if (savedPayload.targetRole) {
        publishNotificationToRoles({
          companyCode,
          event: eventName,
          notification: savedPayload,
          roles: [savedPayload.targetRole],
        });
      }

      return res.json({ notification: savedPayload });
    }

    notification.status = action === 'approve' ? 'approved' : 'rejected';
    notification.isRead = true;
    notification.decisionBy = req.user.id;
    notification.decisionReason = action === 'reject' ? rejectionReason : null;
    await notification.save();

    const savedPayload = notification.get({ plain: true });
    if (requesterId) {
      await publishNotificationToUsers({
        companyCode,
        event: eventName,
        notification: savedPayload,
        userIds: [requesterId],
      });
    }

    return res.json({ notification: savedPayload });
  } catch (error) {
    console.error('Decide request notification error:', error);
    return res.status(500).json({ msg: 'Server error' });
  }
};

const createRequestNotification = async (req, res) => {
  try {
    const companyCode = req.user.companyCode || req.user.id;
    const requesterId = req.user.id;
    const requesterName = req.user.name || 'System';
    const requesterEmail = req.user.email || null;
    const {
      requestType = 'leave_request',
      leaveType,
      fromDate,
      toDate,
      description,
      attachmentUrl,
      title,
      targetUserIds = [],
    } = req.body || {};

    if (requestType === 'leave_request') {
      const requester = req.user;
      const managerTarget = await resolveManagerTarget({ companyCode, requester });
      const payload = buildLeavePayload({
        leaveType: leaveType || title || 'Leave Request',
        fromDate,
        toDate,
        description,
        attachmentUrl,
      });

      const notification = await Notification.create({
        companyCode,
        type: requestType,
        userId: requesterId,
        userName: requesterName,
        userEmail: requesterEmail,
        message: buildLeaveMessage({
          requesterName,
          leaveType: payload.leaveType,
          fromDate,
          toDate,
          statusLabel: 'pending manager review',
        }),
        status: 'pending_manager',
        targetUserId: managerTarget.userId || null,
        targetRole: managerTarget.userId ? null : managerTarget.roleName,
        visibleUserIds: mergeUserIds([requesterId, managerTarget.userId]),
        visibleRoleNames: managerTarget.userId ? null : [managerTarget.roleName],
        workflowStage: 'manager_review',
        decisionBy: null,
        decisionReason: null,
        payload,
      });

      const savedPayload = notification.get({ plain: true });
      if (savedPayload.targetUserId) {
        await publishNotificationToUsers({
          companyCode,
          event: 'notification.created',
          notification: savedPayload,
          userIds: [savedPayload.targetUserId],
        });
      }
      if (savedPayload.targetRole) {
        publishNotificationToRoles({
          companyCode,
          event: 'notification.created',
          notification: savedPayload,
          roles: [savedPayload.targetRole],
        });
      }

      return res.status(201).json({
        notification: savedPayload,
        targets: managerTarget.userId ? [managerTarget.userId] : [],
      });
    }

    const resolvedTargets = await collectHierarchyUserIds({
      companyCode,
      userIds: [requesterId, ...targetUserIds],
    });

    const messageParts = [
      title || requestType.replace('_', ' '),
      fromDate ? `from ${fromDate}` : null,
      toDate ? `to ${toDate}` : null,
      description ? `- ${description}` : null,
    ].filter(Boolean);

    const notification = await Notification.create({
      companyCode,
      type: requestType,
      userId: requesterId,
      userName: requesterName,
      userEmail: requesterEmail,
      message: messageParts.join(' '),
      status: 'pending',
      visibleUserIds: resolvedTargets.length ? resolvedTargets : [requesterId],
      visibleRoleNames: resolvedTargets.length ? null : ['admin', 'sadmin'],
    });

    const payload = notification.get({ plain: true });

    if (resolvedTargets.length > 0) {
      await publishNotificationToUsers({
        companyCode,
        event: 'notification.created',
        notification: payload,
        userIds: resolvedTargets,
      });
    } else {
      publishNotificationToAdmin({
        companyCode,
        event: 'notification.created',
        notification: payload,
      });
    }

    return res.status(201).json({
      notification: payload,
      targets: resolvedTargets,
    });
  } catch (error) {
    console.error('Create request notification error:', error);
    return res.status(500).json({ msg: 'Server error' });
  }
};

module.exports = {
  getNotifications,
  streamNotifications,
  markAsRead,
  createRequestNotification,
  decideRequestNotification,
};
