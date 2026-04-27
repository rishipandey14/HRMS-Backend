const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const { requirePermission } = require('../middleware/rbacMiddleware');
const {
  sendMessage,
  getMessagesByChat,
  editMessage,
  deleteMessage,
  markMessageSeen,
  getUnreadCount,
} = require("../controllers/messageController");

router.post("/", authMiddleware, requirePermission('message.create'), sendMessage);
router.get("/:chatId", authMiddleware, requirePermission('message.view'), getMessagesByChat);
router.get("/:chatId/unread", authMiddleware, requirePermission('message.view'), getUnreadCount);
router.put("/:id", authMiddleware, requirePermission('message.update'), editMessage);
router.delete("/:id", authMiddleware, requirePermission('message.delete'), deleteMessage);
router.put("/:id/seen", authMiddleware, requirePermission('message.update'), markMessageSeen);

module.exports = router;
