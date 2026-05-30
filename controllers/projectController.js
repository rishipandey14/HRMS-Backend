const { Op } = require('sequelize');
const { seq } = require('../config/db');
const Project = require("../models/Project/Project");
const Task = require("../models/Project/Task");
const User = require("../models/User/User");
const parsePagination = require("../utils/pagination");
const { validateSubscriptionCapacity } = require('../services/subscriptionService');
const Notification = require('../models/Others/Notification');
const { publishNotificationToUsers } = require('../services/notificationSseService');
const { collectHierarchyUserIds } = require('../services/notificationHierarchyService');

const getProjectsByCompany = async (req, res) => {
  try {
    const { companyId } = req.params;
    const userId = req.user.id;
    const role = req.userRole;
    const companyCode = req.user.companyCode || req.user.id; // company accounts don't have companyCode

    if (companyCode !== companyId) {
      return res.status(403).json({ error: "Access denied: wrong company" });
    }

    let whereClause = { companyId };

    // For non-admin users, filter by participants JSON array
    if (!(role === "admin" || role === "sadmin")) {
      const participantFilter = {
        [Op.or]: [
          seq.where(
            seq.fn('JSON_CONTAINS', seq.col('participants'), seq.fn('JSON_ARRAY', userId)),
            1
          ),
          seq.where(
            seq.fn('JSON_CONTAINS', seq.col('participants'), seq.fn('JSON_ARRAY', String(userId))),
            1
          )
        ]
      };
      whereClause = {
        companyId,
        [Op.and]: [participantFilter]
      };
    }

    const { page, limit } = parsePagination(req.query);
    const offset = (page - 1) * limit;
    const { rows: projects, count: total } = await Project.findAndCountAll({
      where: whereClause,
      limit,
      offset,
      order: [["createdAt", "DESC"]]
    });

    return res.json({ total, page, limit, projects });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Error fetching projects" });
  }
};

// NEW ENDPOINT: Get projects with task statistics in ONE call
const getProjectsByCompanyWithStats = async (req, res) => {
  try {
    const { companyId } = req.params;
    const userId = req.user.id;
    const role = req.userRole;
    const companyCode = req.user.companyCode || req.user.id;

    if (companyCode !== companyId) {
      return res.status(403).json({ error: "Access denied: wrong company" });
    }

    let whereClause = { companyId };

    // For non-admin users, filter by participants JSON array
    if (!(role === "admin" || role === "sadmin")) {
      const participantFilter = {
        [Op.or]: [
          seq.where(
            seq.fn('JSON_CONTAINS', seq.col('participants'), seq.fn('JSON_ARRAY', userId)),
            1
          ),
          seq.where(
            seq.fn('JSON_CONTAINS', seq.col('participants'), seq.fn('JSON_ARRAY', String(userId))),
            1
          )
        ]
      };
      whereClause = {
        companyId,
        [Op.and]: [participantFilter]
      };
    }

    const { page, limit } = parsePagination(req.query);
    const offset = (page - 1) * limit;
    const {rows: projects, count: total} = await Project.findAndCountAll({
      where: whereClause,
      limit,
      offset,
      order: [["createdAt", "DESC"]],
    })

    // Fetch ALL tasks for these projects in ONE query
    const projectIds = projects.map(p => p.id);
    const allTasks = await Task.findAll({
      where: {
        projectId: projectIds
      },
      attributes: ["id", "projectId", "status"]
    })

    // Build task stats map
    const taskStatsByProject = {};
    allTasks.forEach(task => {
      if (!taskStatsByProject[task.projectId]) {
        taskStatsByProject[task.projectId] = {
          total: 0,
          completed: 0
        };
      }
      taskStatsByProject[task.projectId].total += 1;
      if (task.status === 'Completed') {
        taskStatsByProject[task.projectId].completed += 1;
      }
    });

    // Attach stats to projects
    const projectsWithStats = projects.map(project => {
      const stats = taskStatsByProject[project.id] || { total: 0, completed: 0 };
      const progress = stats.total === 0 ? 0 : Math.round((stats.completed / stats.total) * 100);
      return {
        ...project.toJSON(),
        taskStats: stats,
        taskProgress: progress
      };
    });

    return res.json({ total, page, limit, projects: projectsWithStats });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Error fetching projects with stats" });
  }
};

const getProjectById = async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user.id;
    const role = req.userRole;
    const companyCode = req.user.companyCode || req.user.id;

    const project = await Project.findByPk(projectId);
    
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    if (project.companyId !== companyCode) {
      return res.status(403).json({ error: "Access denied: wrong company" });
    }

    // participants is stored as JSON array of user IDs
    const participantIds = Array.isArray(project.participants) ? project.participants : [];
    
    if (
      !(role === "admin" || role === "sadmin") &&
      !participantIds.includes(userId)
    ) {
      return res
        .status(403)
        .json({ error: "Access denied: not a participant" });
    }

    // Fetch full user details for participants if needed
    let projectData = project.toJSON();
    if (participantIds.length > 0) {
      const participantUsers = await User.findAll({
        where: { id: participantIds },
        attributes: { exclude: ["password"] }
      });
      projectData.participantDetails = participantUsers;
    }

    return res.json(projectData);
  } catch (err) {
    console.error("Error fetching project:", err);
    return res.status(500).json({ error: "Error fetching project", message: err.message });
  }
};

const createProject = async (req, res) => {
  try {
    const userId = req.user.id;
    const userType = req.userType || req.user.type;
    // For company accounts, use id; for users, use companyCode
    const companyId = req.user.companyCode || req.user.id;

    const access = await validateSubscriptionCapacity(companyId, 'project');
    if (!access.allowed) {
      return res.status(access.status).json({ error: access.message, subscription: access.context });
    }

    // Generate unique 4-digit project ID
    let projectId, idTaken;
    do {
      projectId = Math.floor(1000 + Math.random() * 9000).toString();
      idTaken = await Project.findOne({
        where: { id: projectId }
      });
    } while (idTaken);

    // For company accounts, createdBy should be null since company ID is not a user ID
    const createdBy = userType === 'company' ? null : userId;
    const updatedBy = userType === 'company' ? null : userId;

    // Clean and validate participants array
    let participants = req.body.participants;
    if (Array.isArray(participants)) {
      // Remove null/undefined/empty values
      participants = participants.filter(p => p !== null && p !== undefined && p !== '');
      
      // Validate that all participant IDs exist in the users table
      if (participants.length > 0) {
        const validUsers = await User.findAll({
          where: { 
            id: { [Op.in]: participants },
            companyCode: companyId
          },
          attributes: ['id']
        });
        
        // Only keep IDs that exist in the database
        const validUserIds = validUsers.map(u => u.id);
        participants = participants.filter(p => validUserIds.includes(p));
      }
    } else {
      participants = [];
    }

    const project = await Project.create({
      ...req.body,
      id: projectId,
      companyId,
      createdBy,
      updatedBy,
      participants,
    });

    try {
      const notification = await Notification.create({
        companyCode: companyId,
        type: 'other',
        userId: createdBy,
        userName: req.user?.name || 'System',
        userEmail: req.user?.email || null,
        message: `Project created: ${project.title}`,
        status: 'pending',
      });

      const targetUserIds = await collectHierarchyUserIds({
        companyCode: companyId,
        userIds: [createdBy, ...participants],
      });

      if (targetUserIds.length > 0) {
        await publishNotificationToUsers({
          companyCode: companyId,
          event: 'notification.created',
          notification: notification.get({ plain: true }),
          userIds: targetUserIds,
        });
      }
    } catch (notifyError) {
      console.error('Project create notification error:', notifyError);
    }

    return res.status(201).json(project);
  } catch (err) {
    console.error(err);
    return res.status(400).json({ error: err.message });
  }
};

const updateProject = async (req, res) => {
  try {
    const userId = req.user.id || req.user.id; // Handle both id and id
    const companyCode = req.user.companyCode || req.user.id; // company accounts may use id
    const { projectId } = req.params;

    const project = await Project.findByPk(projectId);
    if (!project) return res.status(404).json({ error: "Project not found" });

    if (project.companyId !== companyCode) {
      return res.status(403).json({ error: "Access denied: wrong company" });
    }

    const updated = await project.update(
      { ...req.body, updatedBy: userId }
    );

    if (req.body?.isCompleted === true || req.body?.status === 'Completed') {
      try {
        const targetUserIds = await collectHierarchyUserIds({
          companyCode,
          userIds: [project.createdBy, ...(Array.isArray(project.participants) ? project.participants : [])],
        });

        if (targetUserIds.length > 0) {
          const notification = await Notification.create({
            companyCode,
            type: 'other',
            userId: project.createdBy || userId,
            userName: req.user?.name || 'System',
            userEmail: req.user?.email || null,
            message: `Project completed: ${project.title}`,
            status: 'pending',
          });

          await publishNotificationToUsers({
            companyCode,
            event: 'notification.created',
            notification: notification.get({ plain: true }),
            userIds: targetUserIds,
          });
        }
      } catch (notifyError) {
        console.error('Project completion notification error:', notifyError);
      }
    }

    return res.json(updated);
  } catch (err) {
    console.error(err);
    return res.status(400).json({ error: err.message });
  }
};

const deleteProject = async (req, res) => {
  try {
    const companyCode = req.user.companyCode || req.user.id; // company accounts may use id
    const { projectId } = req.params;

    const project = await Project.findByPk(projectId);
    if (!project) return res.status(404).json({ error: "Project not found" });

    if (project.companyId !== companyCode) {
      return res.status(403).json({ error: "Access denied: wrong company" });
    }

    await project.destroy();

    return res.status(204).send();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
};

module.exports = {
  getProjectsByCompany,
  getProjectsByCompanyWithStats,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
};
