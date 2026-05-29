const Notification = require('../models/Others/Notification');
const {
  addClient,
  removeClient,
  publishNotificationToAdmin,
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

    const streamRole = req.user.role || req.userRole || 'all';
    const key = addClient({ companyCode, role: streamRole, res });
    writeEvent(res, 'notification.connected', { ok: true, companyCode });

    const heartbeat = setInterval(() => {
      res.write(': keep-alive\n\n');
    }, 25000);

    req.on('close', () => {
      clearInterval(heartbeat);
      removeClient({ key, res });
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

module.exports = {
  getNotifications,
  streamNotifications,
  markAsRead
};
