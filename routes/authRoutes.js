const express = require('express');
const router = express.Router();
const { login, logout, verifyToken } = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');

router.post('/login', login);
router.post('/logout', authMiddleware, logout);
router.get('/verify-token', authMiddleware, verifyToken);

module.exports = router;