const Task = require("../models/Task");
const Project = require("../models/Project");
const parsePagination = require("../utils/pagination");

// Helper: resolve project either by Mongo _id or numeric/string project code
const resolveProject = async (projectId) => {
  if (!projectId) return null;
  // If looks like a Mongo ObjectId
  const isObjectId = typeof projectId === "string" && projectId.length === 24;
  if (isObjectId) {
    const proj = await Project.findById(projectId);
    if (proj) return proj;
  }
  // Fallback: treat as business code/id stored in Project._id or a dedicated field
  // Try direct _id match (non-ObjectId string) then common code fields
  const byStringId = await Project.findOne({ _id: projectId });
  if (byStringId) return byStringId;
  const byCode = await Project.findOne({ projectId: projectId });
  if (byCode) return byCode;
  const byCodeAlt = await Project.findOne({ code: projectId });
  return byCodeAlt || null;
};

const getTasksByProject = async (req, res) => {
  try {
    const projectId = req.params.projectId;
    const userId = req.user.id;
    const role = req.user.role;
    const companyCode = req.user.companyCode;

    const project = await resolveProject(projectId);
    if (!project || project.companyId !== companyCode) {
      return res.status(403).json({ error: "Access denied: wrong company" });
    }

    // Allow all project members to see all tasks in the project
    const filter = { projectId: project._id || projectId };

    const { page, limit, skip } = parsePagination(req.query);
    const total = await Task.countDocuments(filter);
    const tasks = await Task.find(filter)
      .populate('assignedTo', 'name email role')
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
    // console.log(req)
    const userId = req.user.id;
    const projectId = req.params.projectId;
    const companyCode = req.user.companyCode;

    if (!projectId) {
      return res.status(400).json({ error: "projectId is required." });
    }

    const project = await resolveProject(projectId);
    if (!project) {
      return res.status(404).json({ error: "Project not found." });
    }
    if (project.companyId !== companyCode) {
      return res.status(403).json({ error: "Access denied: wrong company" });
    }

    // Normalize incoming body to match schema
    const { title, name, dueDate, deadline, startingDate, assignedTo, status } = req.body || {};
    const normalized = {
      title: title || name, // backend requires title
      deadline: dueDate || deadline || undefined,
      startingDate: startingDate || undefined,
      assignedTo: assignedTo || undefined,
      status: status || undefined,
    };

    if (!normalized.title) {
      return res.status(400).json({ error: "title is required" });
    }

    // Generate unique 5-digit task ID string
    let taskId, idTaken;
    do {
      taskId = Math.floor(10000 + Math.random() * 90000).toString();
      idTaken = await Task.findById(taskId);
    } while (idTaken);

    const task = new Task({
      _id: taskId,
      projectId: project._id || projectId,
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
    const userId = req.user.id;
    const companyCode = req.user.companyCode;
    const role = req.user.role;
    const { taskId } = req.params;

    const task = await Task.findById(taskId);
    if (!task) return res.status(404).json({ error: "Task not found" });

    const project = await Project.findById(task.projectId);
    if (!project || project.companyId !== companyCode) {
      return res
        .status(403)
        .json({ error: "Access denied: wrong project or company" });
    }

    const isAdmin = role === "admin" || role === "sadmin";
    const isAssignee = Array.isArray(task.assignedTo)
      ? task.assignedTo.includes(userId)
      : task.assignedTo === userId;

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
