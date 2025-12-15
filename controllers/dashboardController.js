const Project = require("../models/Project");
const Task = require("../models/Task");
const User = require("../models/User");
const Uptime = require("../models/Uptime");

const getDashboardData = async (req, res) => {
  try {
    const userId = req.user._id;
    const role = req.user.role;
    const companyCode = req.user.companyCode || req.user._id;
    const isAdmin = role === "admin" || role === "sadmin";

    // Fetch all projects (for admin) or user's projects
    let projectFilter = { companyId: companyCode };
    if (!isAdmin) {
      projectFilter.participants = userId;
    }

    const allProjects = await Project.find(projectFilter).lean();

    // Calculate project statistics
    const totalProjects = allProjects.length;
    
    // Get all tasks for these projects to calculate status counts
    const projectIds = allProjects.map(p => p._id);
    const tasksFilter = projectIds.length > 0 ? { projectId: { $in: projectIds } } : { projectId: null };
    const allTasks = await Task.find(tasksFilter).lean();

    // Categorize projects by status
    const now = new Date();
    const pendingProjects = allProjects.filter(p => !p.startDate || p.startDate > now);
    const completedProjects = allProjects.filter(p => p.endDate && p.endDate <= now);
    const inProgressProjects = allProjects.filter(p => 
      p.startDate && p.startDate <= now && (!p.endDate || p.endDate > now)
    );

    // Calculate task statistics
    const completedTasks = allTasks.filter(t => t.status === "Completed").length;
    const inProgressTasks = allTasks.filter(t => t.status === "In Progress").length;
    const notStartedTasks = allTasks.filter(t => t.status === "Not Started").length;

    // Get project analytics (last 7 days - or week uptime data)
    const currentWeek = getISOWeek(new Date());
    const uptimeData = isAdmin 
      ? await Uptime.find({ companyId: companyCode, week: currentWeek }).lean()
      : await Uptime.find({ userId, week: currentWeek }).lean();

    // Transform uptime data to daily hours for bar chart
    const daysOfWeek = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const projectAnalytics = daysOfWeek.map(day => {
      const totalHours = uptimeData.reduce((sum, record) => {
        return sum + (record.dailyHours[day] || 0);
      }, 0);
      return {
        name: day.charAt(0),
        value: Math.round(totalHours)
      };
    });

    // Get total daily hours for time tracker (sum of all days)
    let totalDailyHours = 0;
    uptimeData.forEach(record => {
      daysOfWeek.forEach(day => {
        totalDailyHours += record.dailyHours[day] || 0;
      });
    });

    // Get team collaboration - tasks with project info grouped by person
    let collaborationTasks = [];
    if (projectIds.length > 0) {
      collaborationTasks = await Task.find(tasksFilter)
        .populate("assignedTo", "name email _id")
        .populate("projectId", "title _id")
        .lean();
    }

    // Group tasks by person and project
    const teamMembersMap = {};
    collaborationTasks.forEach(task => {
      if (task.assignedTo && Array.isArray(task.assignedTo)) {
        task.assignedTo.forEach(member => {
          if (member && member._id) {
            if (!teamMembersMap[member._id]) {
              teamMembersMap[member._id] = {
                _id: member._id,
                name: member.name,
                email: member.email,
                projectTasks: {} // Group by project
              };
            }
            
            const projectId = task.projectId?._id || task.projectId;
            const projectTitle = task.projectId?.title || "Unknown Project";
            
            if (!teamMembersMap[member._id].projectTasks[projectId]) {
              teamMembersMap[member._id].projectTasks[projectId] = {
                projectId,
                projectTitle,
                tasks: []
              };
            }
            
            teamMembersMap[member._id].projectTasks[projectId].tasks.push({
              _id: task._id,
              title: task.title,
              status: task.status,
              deadline: task.deadline
            });
          }
        });
      }
    });

    // Convert projectTasks object to array
    const teamMembers = Object.values(teamMembersMap).map(member => ({
      ...member,
      projectTasks: Object.values(member.projectTasks),
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${member.name}`
    })).slice(0, 10); // Top 10 team members

    // Get generic reminders (no task-based)
    const reminders = [
      {
        _id: 1,
        title: "Team Standup",
        time: "10:00 AM",
        date: new Date().toLocaleDateString('en-GB')
      },
      {
        _id: 2,
        title: "Project Review",
        time: "02:00 PM",
        date: new Date().toLocaleDateString('en-GB')
      }
    ];

    return res.json({
      success: true,
      data: {
        // Stats Cards
        totalProjects,
        endedProjects: completedProjects.length,
        runningProjects: inProgressProjects.length,
        pendingProjects: pendingProjects.length,
        
        // Project Analytics (bar chart)
        projectAnalytics,
        
        // Project Progress (pie chart)
        projectProgress: {
          completed: completedTasks,
          inProgress: inProgressTasks,
          pending: notStartedTasks
        },
        
        // Team Collaboration (grouped by person and project)
        teamMembers,
        
        // Reminders (generic)
        reminders,
        
        // Time Tracker
        totalDailyHours: Math.round(totalDailyHours * 100) / 100, // Convert to decimal hours
        
        // Additional info
        isAdmin,
        userRole: role,

        // Projects list for UI (admin: all company projects; user: participant projects)
        projects: allProjects.map(p => ({
          _id: p._id,
          title: p.title,
          endDate: p.endDate,
          startDate: p.startDate,
          participants: Array.isArray(p.participants) ? p.participants : [],
          color: '#60a5fa' // UI color hint (optional)
        }))
      }
    });
  } catch (error) {
    console.error("Dashboard error:", error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || "Error fetching dashboard data" 
    });
  }
};

// Helper function to get ISO week
function getISOWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

module.exports = { getDashboardData };
