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

// File upload for chat messages
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const UPLOAD_DIR = path.resolve(__dirname, '..', 'public_uploads');
try { fs.mkdirSync(UPLOAD_DIR, { recursive: true }); } catch (e) {}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

const getPublicBaseUrl = (req) => {
  return process.env.PUBLIC_BACKEND_BASE_URL || `${req.protocol}://${req.get('host')}`;
};

router.post('/upload', authMiddleware, requirePermission('message.create'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const fileUrl = `${getPublicBaseUrl(req)}/uploads/${path.basename(req.file.path)}`;
    return res.json({
      fileUrl,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      fileMimeType: req.file.mimetype,
    });
  } catch (err) {
    console.error('Message upload error:', err);
    return res.status(500).json({ error: 'Upload failed' });
  }
});

module.exports = router;
