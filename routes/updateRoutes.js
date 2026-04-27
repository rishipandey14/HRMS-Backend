const express = require("express");
const router = express.Router({ mergeParams: true });

const authMiddleware = require("../middleware/authMiddleware");
const { requirePermission } = require('../middleware/rbacMiddleware');
const updateController = require("../controllers/updateController");

router.use(authMiddleware);

router.get("/", requirePermission('update.view'), updateController.getUpdatesByTask);
router.get("/:updateId", requirePermission('update.view'), updateController.getUpdateById);
router.post('/', requirePermission('update.create'), updateController.createUpdate);
router.put('/:updateId', requirePermission('update.update'), updateController.updateUpdate);
router.delete('/:updateId', requirePermission('update.delete'), updateController.deleteUpdate);

module.exports = router;
