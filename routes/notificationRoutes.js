const express = require('express');
const router = express.Router();
const { 
  getNotifications, 
  streamNotifications,
  markAsRead,
  createRequestNotification,
  decideRequestNotification
} = require('../controllers/notificationController');
const authMiddleware = require('../middleware/authMiddleware');

const sseTokenMiddleware = (req, res, next) => {
  if (!req.headers.authorization && req.query?.token) {
    req.headers.authorization = `Bearer ${req.query.token}`;
  }
  next();
};

// Get notifications visible to the logged-in user
router.get('/', authMiddleware, getNotifications);

// Stream real-time notifications via SSE
router.get('/stream', sseTokenMiddleware, authMiddleware, streamNotifications);

// Mark notification as read
router.patch('/:notificationId/read', authMiddleware, markAsRead);

// Approve or reject request notifications
router.patch('/:notificationId/decision', authMiddleware, decideRequestNotification);

// Create request notifications for leave / regularization submissions
router.post('/requests', authMiddleware, createRequestNotification);

module.exports = router;
