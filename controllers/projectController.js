const Project = require("../models/Project");
const parsePagination = require("../utils/pagination");

const getProjectsByCompany = async (req, res) => {
  try {
    const { companyId } = req.params;
    const userId = req.user._id;
    const role = req.user.role;
    const companyCode = req.user.companyCode || req.user._id; // company accounts don't have companyCode

    if (companyCode !== companyId) {
      return res.status(403).json({ error: "Access denied: wrong company" });
    }

    const filter = { companyId };

    if (!(role === "admin" || role === "sadmin")) {
      filter.participants = userId;
    }

    const { page, limit, skip } = parsePagination(req.query);
    const total = await Project.countDocuments(filter);
    const projects = await Project.find(filter).skip(skip).limit(limit).lean();

    return res.json({ total, page, limit, projects });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Error fetching projects" });
  }
};

const getProjectById = async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user._id || req.user.id; // Handle both _id and id
    const role = req.user.role;
    const companyCode = req.user.companyCode || req.user._id; // company accounts may use _id

    const project = await Project.findById(projectId)
      .populate('participants', '-password') // Populate participants with full user data
      .lean();
    
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    if (project.companyId !== companyCode) {
      return res.status(403).json({ error: "Access denied: wrong company" });
    }

    if (
      !(role === "admin" || role === "sadmin") &&
      (!project.participants || !project.participants.map(p => p._id || p).includes(userId))
    ) {
      return res
        .status(403)
        .json({ error: "Access denied: not a participant" });
    }

    return res.json(project);
  } catch (err) {
    console.error("Error fetching project:", err);
    return res.status(500).json({ error: "Error fetching project", message: err.message });
  }
};

const createProject = async (req, res) => {
  try {
    const userId = req.user._id;
    // For company accounts, use _id; for users, use companyCode
    const companyId = req.user.companyCode || req.user._id;

    // Generate unique 4-digit project ID
    let projectId, idTaken;
    do {
      projectId = Math.floor(1000 + Math.random() * 9000).toString();
      idTaken = await Project.findById(projectId);
    } while (idTaken);

    const project = new Project({
      ...req.body,
      _id: projectId,
      companyId,
      createdBy: userId,
      updatedBy: userId,
    });

    await project.save();

    return res.status(201).json(project);
  } catch (err) {
    console.error(err);
    return res.status(400).json({ error: err.message });
  }
};

const updateProject = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id; // Handle both _id and id
    const companyCode = req.user.companyCode || req.user._id; // company accounts may use _id
    const { projectId } = req.params;

    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ error: "Project not found" });

    if (project.companyId !== companyCode) {
      return res.status(403).json({ error: "Access denied: wrong company" });
    }

    const updated = await Project.findByIdAndUpdate(
      projectId,
      { ...req.body, updatedBy: userId },
      { new: true, runValidators: true }
    );

    return res.json(updated);
  } catch (err) {
    console.error(err);
    return res.status(400).json({ error: err.message });
  }
};

const deleteProject = async (req, res) => {
  try {
    const companyCode = req.user.companyCode || req.user._id; // company accounts may use _id
    const { projectId } = req.params;

    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ error: "Project not found" });

    if (project.companyId !== companyCode) {
      return res.status(403).json({ error: "Access denied: wrong company" });
    }

    await Project.findByIdAndDelete(projectId);

    return res.status(204).send();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
};

module.exports = {
  getProjectsByCompany,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
};
