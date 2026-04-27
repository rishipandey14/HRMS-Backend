const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const { requirePermission } = require('../middleware/rbacMiddleware');
const projectController = require("../controllers/projectController");
const taskRoutes = require("./taskRoutes");

router.use(authMiddleware);

router.get("/company/:companyId/with-stats", requirePermission('project.view'), projectController.getProjectsByCompanyWithStats);
router.get("/company/:companyId", requirePermission('project.view'), projectController.getProjectsByCompany);
router.get("/:projectId", requirePermission('project.view'), projectController.getProjectById);
router.post('/', requirePermission('project.create'), projectController.createProject);
router.put('/:projectId', requirePermission('project.update'), projectController.updateProject);
router.delete('/:projectId', requirePermission('project.delete'), projectController.deleteProject);

router.use("/:projectId/tasks", taskRoutes);

module.exports = router;
