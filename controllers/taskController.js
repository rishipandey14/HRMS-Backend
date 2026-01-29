const Task = require("../models/Task");
const Project = require("../models/Project");
const parsePagination = require("../utils/pagination");

const getTasksByProject = async (req, res) => {
  try {
    const projectId = req.params.projectId;
    const userId = req.user._id;
    const role = req.user.role;
    const companyCode = req.user.companyCode || req.user._id;

    const project = await Project.findById(projectId);
    if (!project || project.companyId !== companyCode) {
      return res.status(403).json({ error: "Access denied: wrong company" });
    }

    const { page, limit, skip } = parsePagination(req.query);
    const total = await Task.countDocuments({ projectId });
    const tasks = await Task.find({ projectId })
      .populate('createdBy', '-password')
      .populate('updatedBy', '-password')
      .skip(skip)
      .limit(limit)
      .lean();

    return res.json({ total, page, limit, tasks });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Error fetching tasks" });
  }
};

const getTaskById = async (req, res) => {
  try {
    const { taskId } = req.params;
    const userId = req.user._id;
    const role = req.user.role;
    const companyCode = req.user.companyCode || req.user._id;

    const task = await Task.findById(taskId)
      .populate('projectId')
      .populate('createdBy', '-password')
      .populate('updatedBy', '-password')
      .lean();
    
    if (!task) return res.status(404).json({ error: "Task not found" });

    if (task.projectId.companyId !== companyCode) {
      return res.status(403).json({ error: "Access denied: wrong project or company" });
    }

    if (!(role === "admin" || role === "sadmin")) {
      const assignedUserIds = Array.isArray(task.assignedTo) ? task.assignedTo : [task.assignedTo];
      if (!assignedUserIds.map(id => id.toString()).includes(userId.toString())) {
        return res.status(403).json({ error: "Access denied: not assigned to this task" });
      }
    }

    return res.json(task);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Error fetching task" });
  }
};

const createTask = async (req, res) => {
  try {
    const userId = req.user._id;
    const projectId = req.params.projectId;
    const companyCode = req.user.companyCode || req.user._id;

    if (!projectId) {
      return res.status(400).json({ error: "projectId is required." });
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: "Project not found." });
    }
    if (project.companyId !== companyCode) {
      return res.status(403).json({ error: "Access denied: wrong company" });
    }

    const { title, name, dueDate, deadline, startingDate, assignedTo, status } = req.body || {};
    const normalized = {
      title: title || name,
      deadline: dueDate || deadline || undefined,
      startingDate: startingDate || undefined,
      assignedTo: assignedTo || undefined,
      status: status || undefined,
    };

    if (!normalized.title) {
      return res.status(400).json({ error: "title is required" });
    }

    const task = new Task({
      projectId,
      ...normalized,
      createdBy: userId,
      updatedBy: userId,
    });

    await task.save();
    return res.status(201).json(task);
  } catch (err) {
    console.error(err);
    return res.status(400).json({ error: err.message });
  }
};

const updateTask = async (req, res) => {
  try {
    const userId = req.user._id;
    const companyCode = req.user.companyCode || req.user._id;
    const role = req.user.role;
    const { taskId } = req.params;

    const task = await Task.findById(taskId).populate('projectId');
    if (!task) return res.status(404).json({ error: "Task not found" });

    if (task.projectId.companyId !== companyCode) {
      return res.status(403).json({ error: "Access denied: wrong project or company" });
    }

    const isAdmin = role === "admin" || role === "sadmin";
    const assignedUserIds = Array.isArray(task.assignedTo) ? task.assignedTo : [task.assignedTo];
    const isAssignee = assignedUserIds.map(id => id.toString()).includes(userId.toString());

    if (!isAdmin && !isAssignee) {
      return res.status(403).json({ error: "Access denied: not allowed to update this task" });
    }

    const updated = await Task.findByIdAndUpdate(
      taskId,
      { ...req.body, updatedBy: userId },
      { new: true, runValidators: true }
    );

    return res.json(updated);
  } catch (err) {
    console.error(err);
    return res.status(400).json({ error: err.message });
  }
};

const deleteTask = async (req, res) => {
  try {
    const companyCode = req.user.companyCode || req.user._id;
    const { taskId } = req.params;

    const task = await Task.findById(taskId).populate('projectId');
    if (!task) return res.status(404).json({ error: "Task not found" });

    if (task.projectId.companyId !== companyCode) {
      return res.status(403).json({ error: "Access denied: wrong project or company" });
    }

    await Task.findByIdAndDelete(taskId);
    return res.status(204).send();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
};

module.exports = {
  getTasksByProject,
  getTaskById,
  createTask,
  updateTask,
  deleteTask,
};
