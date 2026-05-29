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
const { requirePermission } = require('../middleware/rbacMiddleware');

const sseTokenMiddleware = (req, res, next) => {
  if (!req.headers.authorization && req.query?.token) {
    req.headers.authorization = `Bearer ${req.query.token}`;
  }
  next();
};

// Get all notifications for the logged-in company
router.get('/', authMiddleware, requirePermission('notification.view'), getNotifications);

// Stream real-time notifications via SSE
router.get('/stream', sseTokenMiddleware, authMiddleware, requirePermission('notification.view'), streamNotifications);

// Mark notification as read
router.patch('/:notificationId/read', authMiddleware, requirePermission('notification.update'), markAsRead);

// Approve or reject request notifications
router.patch('/:notificationId/decision', authMiddleware, requirePermission('notification.update'), decideRequestNotification);

// Create request notifications for leave / regularization submissions
router.post('/requests', authMiddleware, createRequestNotification);

module.exports = router;
