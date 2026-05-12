const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');
const { createJob, listJobs, rankForJob } = require('../controllers/jobsController');

// Only admin/hr can create or rank
const allowed = ['admin', 'hr', 'hr_manager', 's_admin'];

router.post('/', auth, roleMiddleware(allowed), createJob);
router.get('/', auth, roleMiddleware(allowed), listJobs);
router.post('/:id/rank', auth, roleMiddleware(allowed), rankForJob);

module.exports = router;
