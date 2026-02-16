const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
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

router.get("/", authMiddleware, getAllChats);
router.post("/group", authMiddleware, createGroupChat);
router.get("/:id", authMiddleware, getChatById);
router.put("/group/:id", authMiddleware, updateGroupChat);
router.put("/:id/archive", authMiddleware, toggleArchive);
router.put("/:id/mute", authMiddleware, toggleMute);
router.delete("/:id", authMiddleware, deleteChat);
router.put("/group/:id/leave", authMiddleware, leaveGroup);
router.post("/", authMiddleware, createDirectChat);

module.exports = router;
