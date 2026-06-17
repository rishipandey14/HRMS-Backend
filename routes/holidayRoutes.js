const express = require('express');
const router = express.Router();

const authMiddleware = require('../middleware/authMiddleware');
const { requireCompanyAdmin } = require('../middleware/rbacMiddleware');
const {
	createHoliday,
	deleteHoliday,
	listHolidays,
	updateHoliday,
} = require('../controllers/holidayController');

router.use(authMiddleware);

router.get('/', listHolidays);
router.post('/', requireCompanyAdmin, createHoliday);
router.patch('/:holidayId', requireCompanyAdmin, updateHoliday);
router.delete('/:holidayId', requireCompanyAdmin, deleteHoliday);

module.exports = router;