const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const { requirePermission } = require('../middleware/rbacMiddleware');
const { getDashboardData } = require("../controllers/dashboardController");

router.use(authMiddleware);

router.get("/", requirePermission('dashboard.view'), getDashboardData);

module.exports = router;
