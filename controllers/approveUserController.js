// controllers/approveUserController.js

const User = require('../models/User');
const Notification = require('../models/Notification');
const { seq } = require('../config/db');

// Approve or reject user
const approveUser = async (req, res) => {
  const transaction = await seq.transaction();

  try {
    const { userId, action } = req.body;

    // Validate action
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ msg: 'Invalid action' });
    }

    // Find user
    const user = await User.findByPk(userId, { transaction });
    if (!user) {
      await transaction.rollback();
      return res.status(404).json({ msg: 'User not found' });
    }

    // Determine new role
    const newRole = action === 'approve' ? 'employee' : 'unauthorized';
    const notificationStatus = action === 'approve' ? 'approved' : 'rejected';

    // Update user role
    await user.update({ role: newRole }, { transaction });

    // Update related notification status
    await Notification.update(
      { status: notificationStatus, isRead: true },
      { 
        where: { userId, type: 'user_approval', status: 'pending' },
        transaction 
      }
    );

    // Commit transaction
    await transaction.commit();

    res.status(200).json({ 
      msg: `User ${action}d successfully`, 
      role: user.role 
    });
  } catch (error) {
    // Rollback transaction on error
    await transaction.rollback();
    console.error('Error approving/rejecting user:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};

module.exports = { approveUser };