const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const { requirePermission } = require('../middleware/rbacMiddleware');
const {
  createGroupChat,
  getAllChats,
  getChatById,
  updateGroupChat,
  toggleArchive,
  toggleMute,
  deleteChat,
  leaveGroup,
  createDirectChat,
} = require("../controllers/chatController");

router.get("/", authMiddleware, requirePermission('chat.view'), getAllChats);
router.post("/group", authMiddleware, requirePermission('chat.create'), createGroupChat);
router.get("/:id", authMiddleware, requirePermission('chat.view'), getChatById);
router.put("/group/:id", authMiddleware, requirePermission('chat.update'), updateGroupChat);
router.put("/:id/archive", authMiddleware, requirePermission('chat.update'), toggleArchive);
router.put("/:id/mute", authMiddleware, requirePermission('chat.update'), toggleMute);
router.delete("/:id", authMiddleware, requirePermission('chat.delete'), deleteChat);
router.put("/group/:id/leave", authMiddleware, requirePermission('chat.update'), leaveGroup);
router.post("/", authMiddleware, requirePermission('chat.create'), createDirectChat);

module.exports = router;
