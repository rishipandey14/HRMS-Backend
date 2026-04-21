// const mongoose = require('mongoose');
require("dotenv").config();
const { Sequelize } = require("sequelize");

// Prefer DB_URL but fall back to DB_URI to avoid mismatched env var names
const enableSqlLogging = process.env.SQL_LOGGING === "true";
const seq = new Sequelize(process.env.DB_URL || process.env.DB_URI, {
  logging: enableSqlLogging ? console.log : false,
});

const resolveSyncOptions = () => {
  // Supported values: none | safe | alter | force
  const syncMode = (process.env.SEQUELIZE_SYNC_MODE || "none").toLowerCase();

  if (syncMode === "none") {
    return null;
  }

  if (syncMode === "alter") {
    return { alter: true };
  }

  if (syncMode === "force") {
    return { force: true };
  }

  return { alter: false };
};

const connectDB = async () => {
  try {
    await seq.authenticate();
    console.log('DataBase connected');
    
    // Import all models
    const Company = require('../models/Company/Company');
    const User = require('../models/User/User');
    const Project = require('../models/Project/Project');
    const Task = require('../models/Project/Task');
    const Update = require('../models/Project/Update');
    const Session = require('../models/Others/Session');
    const Uptime = require('../models/Others/Uptime');
    const Notification = require('../models/Others/Notification');
    const Plans = require('../models/Plans/Plans');
    const CompanySubscription = require('../models/Plans/CompanySubscription');
    const CompanyPlanOverride = require('../models/Plans/CompanyPlanOverride');
    const PlanAddon = require('../models/Plans/PlanAddon');
    const SubscriptionAddon = require('../models/Plans/SubscriptionAddon');
    const Role = require('../models/RolesAndPermission/Role');
    const Permission = require('../models/RolesAndPermission/Permission');
    const RolePermission = require('../models/RolesAndPermission/RolePermission');
    const UserRole = require('../models/User/UserRole');
    
    // Chat models
    const Chat = require('../models/Chat/Chat');
    const Message = require('../models/Chat/Message');
    const ChatMember = require('../models/Chat/ChatMember');
    const ChatAdmin = require('../models/Chat/ChatAdmin');
    const ChatArchived = require('../models/Chat/ChatArchived');
    const ChatMuted = require('../models/Chat/ChatMuted');
    const MessageReadStatus = require('../models/Chat/MessageReadStatus');
    const PinnedMessage = require('../models/Chat/PinnedMessage');
    
    // Set up chat and message associations
    if (Chat.setupAssociations) Chat.setupAssociations();
    if (Message.setupAssociations) Message.setupAssociations();
    
    // Keep schema sync opt-in to avoid expensive startup DDL on every boot.
    const syncOptions = resolveSyncOptions();
    if (syncOptions) {
      await seq.sync(syncOptions);
      console.log('All models synchronized', syncOptions);
    } else {
      console.log('Skipped Sequelize sync (SEQUELIZE_SYNC_MODE=none)');
    }
    
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