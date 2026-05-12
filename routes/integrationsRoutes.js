const express = require('express');
const router = express.Router();
const { receiveCandidate } = require('../controllers/integrationsController');

router.post('/candidates', receiveCandidate);

module.exports = router;

module.exports = router;
