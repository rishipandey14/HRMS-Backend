// controllers/approveUserController.js

const User = require('../models/User');

// Approve or reject user
const approveUser = async (req, res) => {
  try {
    const { userId, action } = req.body;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: 'User not found' });

    if (action === 'approve') {
      user.role = 'user'; // or 'admin'
    } else if (action === 'reject') {
      user.role = 'unauthorized';
    } else {
      return res.status(400).json({ msg: 'Invalid action' });
    }

    await user.save();

    res.status(200).json({ msg: `User ${action}d successfully`, role: user.role });
  } catch (error) {
    console.error('Error approving/rejecting user:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};

module.exports = { approveUser };