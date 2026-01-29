const Update = require("../models/Update");
const Task = require("../models/Task");
const Project = require("../models/Project");
const parsePagination = require("../utils/pagination");

const getUpdatesByTask = async (req, res) => {
  try {
    const taskId = req.params.taskId;
    const userId = req.user._id;
    const role = req.user.role;
    const companyCode = req.user.companyCode || req.user._id;

    const task = await Task.findById(taskId).populate('projectId');
    if (!task) return res.status(404).json({ error: "Task not found" });

    if (task.projectId.companyId !== companyCode) {
      return res.status(403).json({ error: "Access denied: wrong company" });
    }

    const assignedUserIds = Array.isArray(task.assignedTo) ? task.assignedTo : [task.assignedTo];
    if (
      role !== "admin" &&
      role !== "sadmin" &&
      !assignedUserIds.map(id => id.toString()).includes(userId.toString())
    ) {
      return res.status(403).json({ error: "Access denied: not assigned to this task" });
    }

    const { page, limit, skip } = parsePagination(req.query);
    const total = await Update.countDocuments({ taskId });
    const updates = await Update.find({ taskId })
      .populate('createdBy', '-password')
      .populate('updatedBy', '-password')
      .skip(skip)
      .limit(limit)
      .sort({ date: -1 })
      .lean();

    return res.json({ total, page, limit, updates });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Error fetching updates" });
  }
};

const getUpdateById = async (req, res) => {
  try {
    const { updateId } = req.params;
    const userId = req.user._id;
    const role = req.user.role;
    const companyCode = req.user.companyCode || req.user._id;

    const update = await Update.findById(updateId)
      .populate('taskId')
      .populate('createdBy', '-password')
      .populate('updatedBy', '-password')
      .lean();
    
    if (!update) return res.status(404).json({ error: "Update not found" });

    const task = update.taskId;
    if (!task) return res.status(404).json({ error: "Task not found" });

    const project = await Project.findById(task.projectId);
    if (!project || project.companyId !== companyCode) {
      return res.status(403).json({ error: "Access denied: wrong company" });
    }

    const assignedUserIds = Array.isArray(task.assignedTo) ? task.assignedTo : [task.assignedTo];
    if (
      role !== "admin" &&
      role !== "sadmin" &&
      !assignedUserIds.map(id => id.toString()).includes(userId.toString())
    ) {
      return res.status(403).json({ error: "Access denied: not assigned to this task" });
    }

    return res.json(update);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Error fetching update" });
  }
};

const createUpdate = async (req, res) => {
  try {
    const userId = req.user._id;
    const taskId = req.params.taskId;
    const role = req.user.role;
    const companyCode = req.user.companyCode || req.user._id;

    if (!userId) {
      return res.status(401).json({ error: "User not found in request context" });
    }

    if (!req.body.status) {
      return res.status(400).json({ error: "Status is required." });
    }

    const task = await Task.findById(taskId).populate('projectId');
    if (!task) return res.status(404).json({ error: "Task not found" });

    const project = task.projectId;
    if (!project) return res.status(404).json({ error: "Project not found" });

    if (project.companyId !== companyCode) {
      return res.status(403).json({ error: "Access denied: wrong company" });
    }

    const assignedUserIds = Array.isArray(task.assignedTo) ? task.assignedTo : [task.assignedTo];
    if (
      role !== "admin" &&
      role !== "sadmin" &&
      !assignedUserIds.map(id => id.toString()).includes(userId.toString())
    ) {
      return res.status(403).json({ error: "Access denied: cannot create update" });
    }

    const update = new Update({
      taskId,
      date: req.body.date || new Date(),
      note: req.body.note || "",
      status: req.body.status,
      createdBy: userId,
      updatedBy: userId,
    });

    await update.save();
    const populated = await Update.findById(update._id)
      .populate('createdBy', '-password')
      .populate('updatedBy', '-password')
      .lean();

    return res.status(201).json(populated);
  } catch (err) {
    console.error(err);
    return res.status(400).json({ error: err.message });
  }
};

const updateUpdate = async (req, res) => {
  try {
    const userId = req.user._id;
    const { updateId } = req.params;
    const role = req.user.role;

    if (!(role === "admin" || role === "sadmin")) {
      return res.status(403).json({ error: "Access denied: admin only" });
    }

    const updated = await Update.findByIdAndUpdate(
      updateId,
      { ...req.body, updatedBy: userId },
      { new: true, runValidators: true }
    );

    if (!updated) return res.status(404).json({ error: "Update not found" });
    return res.json(updated);
  } catch (err) {
    console.error(err);
    return res.status(400).json({ error: err.message });
  }
};

const deleteUpdate = async (req, res) => {
  try {
    const { updateId } = req.params;
    const role = req.user.role;

    if (!(role === "admin" || role === "sadmin")) {
      return res.status(403).json({ error: "Access denied: admin only" });
    }

    const updateRecord = await Update.findByIdAndDelete(updateId);
    if (!updateRecord) return res.status(404).json({ error: "Update not found" });

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
