const express = require("express");
const router = express.Router({ mergeParams: true });

const authMiddleware = require("../middleware/authMiddleware");
const adminMiddleware = require("../middleware/adminMiddleware");
const updateController = require("../controllers/updateController");

router.use(authMiddleware);

router.get("/", updateController.getUpdatesByTask);
router.get("/:updateId", updateController.getUpdateById);
router.post("/", updateController.createUpdate);
router.put("/:updateId", adminMiddleware, updateController.updateUpdate);
router.delete("/:updateId", adminMiddleware, updateController.deleteUpdate);

module.exports = router;
