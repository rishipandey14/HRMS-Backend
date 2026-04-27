const express = require("express");
const router = express.Router({ mergeParams: true });

const authMiddleware = require("../middleware/authMiddleware");
const { requirePermission } = require('../middleware/rbacMiddleware');
const taskController = require("../controllers/taskController");
const updateRoutes = require("./updateRoutes");

router.use(authMiddleware);

router.get("/", requirePermission('task.view'), taskController.getTasksByProject);
router.get("/:taskId", requirePermission('task.view'), taskController.getTaskById);
router.post('/', requirePermission('task.create'), taskController.createTask);
router.put('/:taskId', requirePermission('task.update'), taskController.updateTask);
router.delete('/:taskId', requirePermission('task.delete'), taskController.deleteTask);

router.use("/:taskId/updates", updateRoutes);

module.exports = router;
