const Task = require("../models/Project/Task");
const Project = require("../models/Project/Project");
const User = require("../models/User/User");
const parsePagination = require("../utils/pagination");

const getTasksByProject = async (req, res) => {
  try {
    const projectId = req.params.projectId;
    const userId = req.user.id;
    const role = req.user.role;
    const companyCode = req.user.companyCode || req.user.id;

    const project = await Project.findByPk(projectId, {
      attributes: ["id", "companyId"]
    });
    if (!project || project.companyId !== companyCode) {
      return res.status(403).json({ error: "Access denied: wrong company" });
    }

    const { page, limit } = parsePagination(req.query);
    const offset = (page - 1) * limit;

    const { rows: tasks, count: total } =
      await Task.findAndCountAll({
        where: { projectId },
        limit,
        offset,
        order: [["createdAt", "DESC"]]
      });

    // Populate assignedTo with user details
    const tasksWithUsers = await Promise.all(
      tasks.map(async (task) => {
        const taskData = task.toJSON();
        const assignedUserIds = Array.isArray(taskData.assignedTo) ? taskData.assignedTo : [];
        
        if (assignedUserIds.length > 0) {
          const users = await User.findAll({
            where: { id: assignedUserIds },
            attributes: ['id', 'name', 'email']
          });
          taskData.assignedTo = users.map(user => user.toJSON());
        } else {
          taskData.assignedTo = [];
        }
        
        return taskData;
      })
    );

    return res.json({
      total,
      page,
      limit,
      tasks: tasksWithUsers
    });
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
    const companyCode = req.user.companyCode || req.user.id;

    const task = await Task.findByPk(taskId);
    
    if (!task) return res.status(404).json({ error: "Task not found" });

    const project = await Project.findByPk(task.projectId);
    if (!project || project.companyId !== companyCode) {
      return res.status(403).json({ error: "Access denied: wrong project or company" });
    }

    // assignedTo is stored as JSON array of user IDs
    const assignedUserIds = Array.isArray(task.assignedTo) ? task.assignedTo : [];
    
    if (
      !(role === "admin" || role === "sadmin") &&
      !assignedUserIds.includes(userId)
    ) {
      return res.status(403).json({
        error: "Access denied: not assigned to this task"
      });
    }

    // Populate assignedTo with user details
    const taskData = task.toJSON();
    if (assignedUserIds.length > 0) {
      const users = await User.findAll({
        where: { id: assignedUserIds },
        attributes: ['id', 'name', 'email']
      });
      taskData.assignedTo = users.map(user => user.toJSON());
    } else {
      taskData.assignedTo = [];
    }

    return res.json(taskData);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Error fetching task" });
  }
};

const createTask = async (req, res) => {
  try {
    const userId = req.user.id;
    const userType = req.userType || req.user.type;
    const projectId = req.params.projectId;
    const companyCode = req.user.companyCode || req.user.id;

    if (!projectId) {
      return res.status(400).json({ error: "projectId is required." });
    }

    const project = await Project.findByPk(projectId);
    if (!project) {
      return res.status(404).json({ error: "Project not found." });
    }
    if (project.companyId !== companyCode) {
      return res.status(403).json({ error: "Access denied: wrong company" });
    }

    // Generate unique task ID
    let taskId, idTaken;
    do {
      taskId = Math.floor(1000 + Math.random() * 9000).toString();
      idTaken = await Task.findOne({ where: { id: taskId } });
    } while (idTaken);

    const { title, name, dueDate, deadline, startingDate, assignedTo, status } = req.body || {};
    const normalized = {
      title: title || name,
      deadline: dueDate || deadline || undefined,
      startingDate: startingDate || undefined,
      assignedTo: assignedTo || [],
      status: status || 'Not Started',
    };

    if (!normalized.title) {
      return res.status(400).json({ error: "title is required" });
    }

    // For company accounts, createdBy/updatedBy should be null since company ID is not a user ID
    const createdBy = userType === 'company' ? null : userId;
    const updatedBy = userType === 'company' ? null : userId;

    const task = await Task.create({
      id: taskId,
      projectId,
      ...normalized,
      createdBy,
      updatedBy,
    });

    return res.status(201).json(task);
  } catch (err) {
    console.error(err);
    return res.status(400).json({ error: err.message });
  }
};

const updateTask = async (req, res) => {
  try {
    const userId = req.user.id;
    const userType = req.userType || req.user.type;
    const companyCode = req.user.companyCode || req.user.id;
    const role = req.user.role;
    const { taskId } = req.params;

    const task = await Task.findByPk(taskId);
    if (!task) return res.status(404).json({ error: "Task not found" });

    const project = await Project.findByPk(task.projectId);
    if (!project || project.companyId !== companyCode) {
      return res.status(403).json({ error: "Access denied: wrong project or company" });
    }

    const isAdmin = role === "admin" || role === "sadmin";
    const assignedUserIds = Array.isArray(task.assignedTo) ? task.assignedTo : [];
    const isAssignee = assignedUserIds.includes(userId);

    if (!isAdmin && !isAssignee) {
      return res.status(403).json({ error: "Access denied: not allowed to update this task" });
    }

    // For company accounts, updatedBy should be null
    const updatedBy = userType === 'company' ? null : userId;

    const updated = await task.update(
      { ...req.body, updatedBy }
    );

    return res.json(updated);
  } catch (err) {
    console.error(err);
    return res.status(400).json({ error: err.message });
  }
};

const deleteTask = async (req, res) => {
  try {
    const companyCode = req.user.companyCode || req.user.id;
    const { taskId } = req.params;

    const task = await Task.findByPk(taskId);
    if (!task) return res.status(404).json({ error: "Task not found" });

    const project = await Project.findByPk(task.projectId);
    if (!project || project.companyId !== companyCode) {
      return res.status(403).json({ error: "Access denied: wrong project or company" });
    }

    await task.destroy();
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
