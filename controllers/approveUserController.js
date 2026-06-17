// controllers/approveUserController.js

const User = require('../models/User/User');
const Notification = require('../models/Others/Notification');
const { seq } = require('../config/db');
const Role = require('../models/RolesAndPermission/Role');
const { ensureUserRoleAssignment, seedSystemRolesForCompany } = require('../services/rbacService');
const { publishNotificationToAdmin } = require('../services/notificationSseService');
const { validateSubscriptionCapacity } = require('../services/subscriptionService');

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

    // Set approval status
    const notificationStatus = action === 'approve' ? 'approved' : 'rejected';
    user.approved = action === 'approve';
    await user.save({ transaction });

    if (action === 'approve') {
      const access = await validateSubscriptionCapacity(user.companyCode, 'employee');
      if (!access.allowed) {
        await transaction.rollback();
        return res.status(access.status).json({ msg: access.message, subscription: access.context });
      }
    }

    // Note: Role is no longer stored on User model; managed through UserRole model

    if (action === 'approve') {
      await seedSystemRolesForCompany(user.companyCode);
      const employeeRole = await Role.findOne({
        where: { companyId: user.companyCode, name: 'employee' },
        transaction,
      });

      if (employeeRole) {
        await ensureUserRoleAssignment({
          userId: user.id,
          roleId: employeeRole.id,
          transaction,
        });
      }
    }

    // Update related notification status
    await Notification.update(
      { status: notificationStatus, isRead: true },
      { 
        where: { userId, type: 'user_approval', status: 'pending' },
        transaction 
      }
    );

    const updatedNotification = await Notification.findOne({
      where: { userId, type: 'user_approval' },
      order: [['updatedAt', 'DESC']],
      transaction,
    });

    // Commit transaction
    await transaction.commit();

    if (updatedNotification) {
      publishNotificationToAdmin({
        companyCode: user.companyCode,
        event: 'notification.updated',
        notification: updatedNotification.get({ plain: true }),
      });
    }

    res.status(200).json({ 
      msg: `User ${action}d successfully`,
      approved: user.approved
    });
  } catch (error) {
    // Rollback transaction on error
    await transaction.rollback();
    console.error('Error approving/rejecting user:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};

module.exports = { approveUser };