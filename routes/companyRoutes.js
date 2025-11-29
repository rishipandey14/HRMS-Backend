const express = require('express');
const router = express.Router();
const { signupCompany} = require('../controllers/companyController');
const { approveUser } = require('../controllers/approveUserController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

router.post('/signup', signupCompany);
router.post('/approve', authMiddleware, roleMiddleware(['admin']), approveUser);

module.exports = router;