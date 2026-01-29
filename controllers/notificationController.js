const Notification = require('../models/Notification');

// Get notifications for a company (admin)
const getNotifications = async (req, res) => {
  try {
    // Only admins can view notifications
    if (req.userRole !== 'admin') {
      return res.status(403).json({ msg: 'Only admins can view notifications' });
    }

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

// Mark notification as read
const markAsRead = async (req, res) => {
  try {
    const { notificationId } = req.params;

    const notification = await Notification.findByPk(notificationId);

    if (!notification) {
      return res.status(404).json({ msg: 'Notification not found' });
    }

    notification.isRead = true;
    await notification.save();

    if (!notification) {
      return res.status(404).json({ msg: 'Notification not found' });
    }

    res.json({ notification });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};

module.exports = {
  getNotifications,
  markAsRead
};
