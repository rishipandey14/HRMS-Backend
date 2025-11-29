const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const sessionController = require("../controllers/sessionController");

router.use(authMiddleware);

router.post("/login", sessionController.createSession);
router.post("/logout", sessionController.endSession);

module.exports = router;
