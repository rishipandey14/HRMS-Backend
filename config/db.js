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
    
    // Sync all models with the database (alter: true allows modifications without dropping data)
    await seq.sync({ alter: true });
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