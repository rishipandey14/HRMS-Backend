const express = require("express");
const router = express.Router({ mergeParams: true });

const authMiddleware = require("../middleware/authMiddleware");
const adminMiddleware = require("../middleware/adminMiddleware");
const taskController = require("../controllers/taskController");
const updateRoutes = require("./updateRoutes");

router.use(authMiddleware);

router.get("/", taskController.getTasksByProject);
router.get("/:taskId", taskController.getTaskById);
router.post("/", adminMiddleware, taskController.createTask);
router.put("/:taskId", taskController.updateTask);
router.delete("/:taskId", adminMiddleware, taskController.deleteTask);

router.use("/:taskId/updates", updateRoutes);

module.exports = router;
