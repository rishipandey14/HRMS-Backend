const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const User = require("../models/User");
const Company = require("../models/Company");
const Notification = require('../models/Notification');

// Store secret in env in production
const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret_key";

// Generate a random 6-digit suffix
const generateSuffix = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const signupUser = async (req, res) => {
  try {
    const { companyCode, name, email, password, mobile } = req.body;

    // Validate company code format
    if (!/^\d{6}$/.test(companyCode)) {
      return res.status(400).json({ msg: "Company code must be a 6-digit number" });
    }

    // Validate company exists
    const company = await Company.findByPk(companyCode);
    if (!company) {
      return res.status(400).json({ msg: "Invalid company code: No such company found" });
    }

    // Check if email already exists for this company 
    const existingEmail = await User.findOne({ where: { email, companyCode } });
    if (existingEmail) {
      return res.status(409).json({ msg: "Email already registered under this company" });
    }

    // Create new user (id will auto-increment from 100000)
    // Password will be hashed automatically by the User model's beforeCreate hook
    const newUser = await User.create({
      companyCode,
      name,
      email,
      password, // Pass plain password - model will hash it
      mobile,
      role: "unauthorized", // will be changed after admin approval
    });

    // Create notification for admin approval
    try {
      const notification = await Notification.create({
        companyCode,
        type: 'user_approval',
        userId: newUser.id,
        userName: name,
        userEmail: email,
        message: `${name} has requested to join your company`,
        status: 'pending'
      });
      console.log('Notification created:', notification);
    } catch (notifError) {
      console.error('Failed to create notification:', notifError);
    }

    // Generate JWT for testing (optional for unauthorized)
    const token = jwt.sign(
      { id: newUser.id, role: newUser.role },
      JWT_SECRET,
      { expiresIn: "7d" } // Set to 7 days
    );

    res.status(201).json({
      msg: "Signup request sent for approval",
      userId: newUser.id,
      token, // return for test purposes
    });

  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ msg: "Internal server error" });
  }
};

module.exports = { signupUser };