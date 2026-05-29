const Notification = require('../models/Others/Notification');
const { collectHierarchyUserIds } = require('../services/notificationHierarchyService');
const {
  addClient,
  removeClient,
  publishNotificationToAdmin,
  publishNotificationToRoles,
  publishNotificationToUsers,
  writeEvent,
} = require('../services/notificationSseService');

// Get notifications for a company (admin)
const getNotifications = async (req, res) => {
  try {
    // For Company users, use id as companyCode; for regular users, use companyCode
    const companyCode = req.user.companyCode || req.user.id;
    const { type, status } = req.query;

    const where = { companyCode };
    if (type) where.type = type;
    if (status) where.status = status;

    const notifications = await Notification.findAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: 50
    });

    res.json({ notifications });
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
    const streamRole = req.user.role || req.userRole || 'user';
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

    notification.isRead = true;
    await notification.save();

    publishNotificationToAdmin({
      companyCode,
      event: 'notification.updated',
      notification: notification.get({ plain: true }),
    });

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

    if (!['leave_request', 'regularization_request'].includes(notification.type)) {
      return res.status(400).json({ msg: 'This notification cannot be approved or rejected' });
    }

    notification.status = action === 'approve' ? 'approved' : 'rejected';
    notification.isRead = true;
    await notification.save();

    const payload = notification.get({ plain: true });
    const requesterId = payload.userId;
    const eventName = 'notification.updated';

    if (requesterId) {
      await publishNotificationToUsers({
        companyCode,
        event: eventName,
        notification: payload,
        userIds: [requesterId],
      });
    }

    publishNotificationToRoles({
      companyCode,
      event: eventName,
      notification: payload,
      roles: ['admin', 'hr_manager', 'hr', 'sadmin'],
    });

    return res.json({ notification: payload });
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
      fromDate,
      toDate,
      description,
      attachmentUrl,
      title,
      targetUserIds = [],
    } = req.body || {};

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
