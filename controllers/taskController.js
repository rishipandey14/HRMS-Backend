const Task = require("../models/Task");
const Project = require("../models/Project");
const parsePagination = require("../utils/pagination");

const getTasksByProject = async (req, res) => {
  try {
    const projectId = req.params.projectId;
    const userId = req.user.id;
    const role = req.user.role;
    const companyCode = req.user.companyCode;

    const project = await Project.findById(projectId);
    if (!project || project.companyId !== companyCode) {
      return res.status(403).json({ error: "Access denied: wrong company" });
    }

    const filter = { projectId };
    if (!(role === "admin" || role === "sadmin")) {
      filter.assignedTo = userId;
    }

    const { page, limit, skip } = parsePagination(req.query);
    const total = await Task.countDocuments(filter);
    const tasks = await Task.find(filter).skip(skip).limit(limit).lean();

    return res.json({ total, page, limit, tasks });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Error fetching tasks" });
  }
};

const getTaskById = async (req, res) => {
  try {
    const { taskId } = req.params;
    const userId = req.user.id;
    const role = req.user.role;
    const companyCode = req.user.companyCode;

    const task = await Task.findById(taskId).lean();
    if (!task) return res.status(404).json({ error: "Task not found" });

    const project = await Project.findById(task.projectId);
    if (!project || project.companyId !== companyCode) {
      return res
        .status(403)
        .json({ error: "Access denied: wrong project or company" });
    }

    if (!(role === "admin" || role === "sadmin")) {
      if (!task.assignedTo || !task.assignedTo.includes(userId)) {
        return res
          .status(403)
          .json({ error: "Access denied: not assigned to this task" });
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
    const userId = req.user.id;
    const projectId = req.params.projectId;
    const companyCode = req.user.companyCode;

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

    // Generate unique 5-digit task ID string
    let taskId, idTaken;
    do {
      taskId = Math.floor(10000 + Math.random() * 90000).toString();
      idTaken = await Task.findById(taskId);
    } while (idTaken);

    const task = new Task({
      _id: taskId,
      projectId,
      ...req.body,
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
    const userId = req.user.id;
    const companyCode = req.user.companyCode;
    const { taskId } = req.params;

    const task = await Task.findById(taskId);
    if (!task) return res.status(404).json({ error: "Task not found" });

    const project = await Project.findById(task.projectId);
    if (!project || project.companyId !== companyCode) {
      return res
        .status(403)
        .json({ error: "Access denied: wrong project or company" });
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
    const companyCode = req.user.companyCode;
    const { taskId } = req.params;

    const task = await Task.findById(taskId);
    if (!task) return res.status(404).json({ error: "Task not found" });

    const project = await Project.findById(task.projectId);
    if (!project || project.companyId !== companyCode) {
      return res
        .status(403)
        .json({ error: "Access denied: wrong project or company" });
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
