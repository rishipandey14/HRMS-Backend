const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const adminMiddleware = require("../middleware/adminMiddleware");
const projectController = require("../controllers/projectController");
const taskRoutes = require("./taskRoutes");

router.use(authMiddleware);

router.get("/company/:companyId/with-stats", projectController.getProjectsByCompanyWithStats);
router.get("/company/:companyId", projectController.getProjectsByCompany);
router.get("/:projectId", projectController.getProjectById);
router.post("/", adminMiddleware, projectController.createProject);
router.put("/:projectId", adminMiddleware, projectController.updateProject);
router.delete("/:projectId", adminMiddleware, projectController.deleteProject);

router.use("/:projectId/tasks", taskRoutes);

module.exports = router;
