const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const uptimeController = require("../controllers/uptimeController");

router.get("/", authMiddleware, uptimeController.getUptimes);

module.exports = router;
