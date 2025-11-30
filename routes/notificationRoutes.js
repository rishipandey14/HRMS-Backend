const express = require('express');
const router = express.Router();
const { 
  getNotifications, 
  markAsRead 
} = require('../controllers/notificationController');
const authMiddleware = require('../middleware/authMiddleware');

// Get all notifications for the logged-in company
router.get('/', authMiddleware, getNotifications);

// Mark notification as read
router.patch('/:notificationId/read', authMiddleware, markAsRead);

module.exports = router;
