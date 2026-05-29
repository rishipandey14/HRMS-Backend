const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');
const { listCandidates, getCandidate } = require('../controllers/candidatesController');

// Only allow admin and HR roles
const allowed = ['admin', 'hr', 'hr_manager', 's_admin'];

router.get('/', auth, roleMiddleware(allowed), listCandidates);
router.get('/:id', auth, roleMiddleware(allowed), getCandidate);

module.exports = router;
