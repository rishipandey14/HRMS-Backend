const express = require('express');
const router = express.Router();
const { signupCompany, listCompanyUsers } = require('../controllers/companyController');
const { approveUser } = require('../controllers/approveUserController');
const {
	getCompanySubscription,
	upgradeCompanySubscription,
} = require('../controllers/subscriptionController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

router.post('/signup', signupCompany);
router.post('/approve', authMiddleware, roleMiddleware(['admin']), approveUser);
router.get('/users', authMiddleware, listCompanyUsers);
router.get('/subscription', authMiddleware, getCompanySubscription);
router.post('/subscription/upgrade', authMiddleware, upgradeCompanySubscription);

module.exports = router;