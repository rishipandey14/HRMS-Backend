const express = require('express');
const router = express.Router();
const { signupCompany, listCompanyUsers } = require('../controllers/companyController');
const { approveUser } = require('../controllers/approveUserController');
const {
	getCompanySubscription,
	upgradeCompanySubscription,
} = require('../controllers/subscriptionController');
const authMiddleware = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/rbacMiddleware');
// const { getCachedData } = require('../middleware/redis');

router.post('/signup', signupCompany);
router.post('/approve', authMiddleware, requirePermission('user.update'), approveUser);
router.get('/users', authMiddleware, requirePermission('user.view'), listCompanyUsers);
router.get('/subscription', authMiddleware, requirePermission('subscription.view'), getCompanySubscription);
router.post('/subscription/upgrade', authMiddleware, requirePermission('subscription.update'), upgradeCompanySubscription);

module.exports = router;