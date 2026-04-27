const Update = require("../models/Project/Update");
const Task = require("../models/Project/Task");
const Project = require("../models/Project/Project");
const User = require("../models/User/User");
const parsePagination = require("../utils/pagination");

const hasUpdatePermission = (req, permissionKey) => {
  const permissionKeys = req.rbac?.permissionKeys || [];
  return req.rbac?.isAllAccess || permissionKeys.includes(permissionKey) || permissionKeys.includes('update.manage');
};

const getUpdatesByTask = async (req, res) => {
  try {
    const taskId = req.params.taskId;
    const userId = req.user.id;
    const role = req.user.role;
    const companyCode = req.user.companyCode || req.user.id;

    const task = await Task.findByPk(taskId);
    if (!task) return res.status(404).json({ error: "Task not found" });

    const project = await Project.findByPk(task.projectId);
    if (!project || project.companyId !== companyCode) {
      return res.status(403).json({ error: "Access denied: wrong company" });
    }

    const assignedUserIds = Array.isArray(task.assignedTo) ? task.assignedTo : [];
    if (
      role !== "admin" &&
      role !== "sadmin" &&
      !assignedUserIds.includes(userId)
    ) {
      return res.status(403).json({
        error: "Access denied: not assigned to this task"
      });
    }

    const { page, limit } = parsePagination(req.query);
    const offset = (page - 1) * limit;
    const { rows: updates, count: total } =
      await Update.findAndCountAll({
        where: { taskId },
        order: [["date", "DESC"]],
        limit,
        offset
      });

    // Populate user details for each update
    const updatesWithUsers = await Promise.all(
      updates.map(async (update) => {
        const updateData = update.toJSON();
        
        if (updateData.createdBy) {
          const creator = await User.findByPk(updateData.createdBy);
          updateData.createdByUser = creator ? creator.toJSON() : null;
        }
        
        if (updateData.updatedBy) {
          const updater = await User.findByPk(updateData.updatedBy);
          updateData.updatedByUser = updater ? updater.toJSON() : null;
        }
        
        return updateData;
      })
    );

    return res.json({
      total,
      page,
      limit,
      updates: updatesWithUsers
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Error fetching updates" });
  }
};

const getUpdateById = async (req, res) => {
  try {
    const { updateId } = req.params;
    const userId = req.user.id;
    const role = req.user.role;
    const companyCode = req.user.companyCode || req.user.id;

    const update = await Update.findByPk(updateId);
    if (!update) return res.status(404).json({ error: "Update not found" });

    const task = await Task.findByPk(update.taskId);
    if (!task) return res.status(404).json({ error: "Task not found" });

    const project = await Project.findByPk(task.projectId);
    if (!project || project.companyId !== companyCode) {
      return res.status(403).json({ error: "Access denied: wrong company" });
    }

    const assignedUserIds = Array.isArray(task.assignedTo) ? task.assignedTo : [];
    if (
      role !== "admin" &&
      role !== "sadmin" &&
      !assignedUserIds.includes(userId)
    ) {
      return res.status(403).json({ error: "Access denied: not assigned to this task" });
    }

    const updateData = update.toJSON();
    
    if (updateData.createdBy) {
      const creator = await User.findByPk(updateData.createdBy);
      updateData.createdByUser = creator ? creator.toJSON() : null;
    }
    
    if (updateData.updatedBy) {
      const updater = await User.findByPk(updateData.updatedBy);
      updateData.updatedByUser = updater ? updater.toJSON() : null;
    }

    return res.json(updateData);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Error fetching update" });
  }
};

const createUpdate = async (req, res) => {
  try {
    const userId = req.user.id;
    const userType = req.userType || req.user.type;
    const taskId = req.params.taskId;
    const role = req.user.role;
    const companyCode = req.user.companyCode || req.user.id;

    if (!userId) {
      return res.status(401).json({ error: "User not found in request context" });
    }

    if (!req.body.status) {
      return res.status(400).json({ error: "Status is required." });
    }

    const task = await Task.findByPk(taskId);
    if (!task) return res.status(404).json({ error: "Task not found" });

    const project = await Project.findByPk(task.projectId);
    if (!project) return res.status(404).json({ error: "Project not found" });

    if (project.companyId !== companyCode) {
      return res.status(403).json({ error: "Access denied: wrong company" });
    }

    const assignedUserIds = Array.isArray(task.assignedTo) ? task.assignedTo : [];
    if (
      role !== "admin" &&
      role !== "sadmin" &&
      !assignedUserIds.includes(userId)
    ) {
      return res.status(403).json({ error: "Access denied: cannot create update" });
    }

    // For company accounts, createdBy/updatedBy should be null
    const createdBy = userType === 'company' ? null : userId;
    const updatedBy = userType === 'company' ? null : userId;

    const update = await Update.create({
      taskId,
      date: req.body.date || new Date(),
      note: req.body.note || "",
      status: req.body.status,
      createdBy,
      updatedBy,
    });

    const updateData = update.toJSON();
    
    if (updateData.createdBy) {
      const creator = await User.findByPk(updateData.createdBy);
      updateData.createdByUser = creator ? creator.toJSON() : null;
    }
    
    if (updateData.updatedBy) {
      const updater = await User.findByPk(updateData.updatedBy);
      updateData.updatedByUser = updater ? updater.toJSON() : null;
    }

    return res.status(201).json(updateData);
  } catch (err) {
    console.error(err);
    return res.status(400).json({ error: err.message });
  }
};

const updateUpdate = async (req, res) => {
  try {
    const userId = req.user.id;
    const userType = req.userType || req.user.type;
    const { updateId } = req.params;
    const role = req.user.role;

    if (!(role === "admin" || role === "sadmin") && !hasUpdatePermission(req, 'update.update')) {
      return res.status(403).json({ error: "Access denied: admin only" });
    }

    const update = await Update.findByPk(updateId);
    if (!update) return res.status(404).json({ error: "Update not found" });

    // For company accounts, updatedBy should be null
    const updatedBy = userType === 'company' ? null : userId;

    await update.update({ ...req.body, updatedBy });

    const updateData = update.toJSON();
    
    if (updateData.createdBy) {
      const creator = await User.findByPk(updateData.createdBy);
      updateData.createdByUser = creator ? creator.toJSON() : null;
    }
    
    if (updateData.updatedBy) {
      const updater = await User.findByPk(updateData.updatedBy);
      updateData.updatedByUser = updater ? updater.toJSON() : null;
    }

    return res.json(updateData);
  } catch (err) {
    console.error(err);
    return res.status(400).json({ error: err.message });
  }
};

const deleteUpdate = async (req, res) => {
  try {
    const { updateId } = req.params;
    const role = req.user.role;

    if (!(role === "admin" || role === "sadmin") && !hasUpdatePermission(req, 'update.delete')) {
      return res.status(403).json({ error: "Access denied: admin only" });
    }

    const update = await Update.findByPk(updateId);
    if (!update) return res.status(404).json({ error: "Update not found" });

    await update.destroy();
    return res.status(204).send();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
};

module.exports = {
  getUpdatesByTask,
  getUpdateById,
  createUpdate,
  updateUpdate,
  deleteUpdate,
};
