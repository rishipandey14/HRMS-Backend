// const mongoose = require('mongoose');
require("dotenv").config();
const { Sequelize } = require("sequelize");

// Prefer DB_URL but fall back to DB_URI to avoid mismatched env var names
const seq = new Sequelize(process.env.DB_URL || process.env.DB_URI);

const connectDB = async () => {
  try {
    await seq.authenticate();
    console.log('DataBase connected');
    
    // Import all models
    const Company = require('../models/Company');
    const User = require('../models/User');
    const Project = require('../models/Project');
    const Task = require('../models/Task');
    const Update = require('../models/Update');
    const Session = require('../models/Session');
    const Uptime = require('../models/Uptime');
    const Notification = require('../models/Notification');
    const Plans = require('../models/Plans');
    const CompanySubscription = require('../models/CompanySubscription');
    const CompanyPlanOverride = require('../models/CompanyPlanOverride');
    const PlanAddon = require('../models/PlanAddon');
    const SubscriptionAddon = require('../models/SubscriptionAddon');
    const Role = require('../models/Role');
    const Permission = require('../models/Permission');
    const RolePermission = require('../models/RolePermission');
    const UserRole = require('../models/UserRole');
    
    // Chat models
    const Chat = require('../models/Chat');
    const Message = require('../models/Message');
    const ChatMember = require('../models/ChatMember');
    const ChatAdmin = require('../models/ChatAdmin');
    const ChatArchived = require('../models/ChatArchived');
    const ChatMuted = require('../models/ChatMuted');
    const MessageReadStatus = require('../models/MessageReadStatus');
    const PinnedMessage = require('../models/PinnedMessage');
    
    // Set up chat and message associations
    if (Chat.setupAssociations) Chat.setupAssociations();
    if (Message.setupAssociations) Message.setupAssociations();
    
    // Sync all models with the database
    // Note: disable alter to avoid repeated index creation hitting MySQL's key limit
    await seq.sync({ alter: false });
    console.log('All models synchronized');
    
    // Set auto-increment start value for User id to 100000
    await seq.query('ALTER TABLE users AUTO_INCREMENT=100000;').catch(() => {
      // If table doesn't exist yet, it will be created with proper values
    });
    
  } catch (err) {
    console.error('Unable to connect to the database:', err);
    process.exit(1);
  }
};
module.exports = {connectDB, seq};