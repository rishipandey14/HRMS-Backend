const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  companyCode: {
    type: String,
    required: true,
    ref: 'Company'
  },
  type: {
    type: String,
    enum: ['user_approval', 'comment', 'file_upload', 'task_assigned', 'other'],
    default: 'other'
  },
  userId: {
    type: String,
    ref: 'User'
  },
  userName: {
    type: String,
    required: true
  },
  userEmail: {
    type: String
  },
  message: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'read'],
    default: 'pending'
  },
  isRead: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Notification', notificationSchema);
