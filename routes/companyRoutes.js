const express = require('express');
const router = express.Router();
const { signupCompany, listCompanyUsers } = require('../controllers/companyController');
const { approveUser } = require('../controllers/approveUserController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

router.post('/signup', signupCompany);
router.post('/approve', authMiddleware, roleMiddleware(['admin']), approveUser);

// List all users associated with logged-in company
router.get('/users', authMiddleware, roleMiddleware(['admin']), listCompanyUsers);

module.exports = router;