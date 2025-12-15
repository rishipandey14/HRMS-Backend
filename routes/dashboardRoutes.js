const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const { getDashboardData } = require("../controllers/dashboardController");

router.use(authMiddleware);

router.get("/", getDashboardData);

module.exports = router;
