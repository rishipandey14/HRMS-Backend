const Notification = require('../models/Notification');

// Get notifications for a company (admin)
const getNotifications = async (req, res) => {
  try {
    // Only admins can view notifications
    if (req.userRole !== 'admin') {
      return res.status(403).json({ msg: 'Only admins can view notifications' });
    }

    // For Company users, use _id as companyCode; for regular users, use companyCode
    const companyCode = req.user.companyCode || req.user._id;
    const { type, status } = req.query;

    const filter = { companyCode };
    if (type) filter.type = type;
    if (status) filter.status = status;

    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .limit(50);

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

    const notification = await Notification.findByIdAndUpdate(
      notificationId,
      { isRead: true },
      { new: true }
    );

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
