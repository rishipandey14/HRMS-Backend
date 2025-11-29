// const User = require('../models/User');
// const Company = require('../models/Company');

// // Generate a random 6-digit number as string
// const generateSuffix = () => {
//   return Math.floor(100000 + Math.random() * 900000).toString();
// };

// const signupUser = async (req, res) => {
//   try {
//     const { companyCode, name, email, password, mobile } = req.body;

//     // Ensure companyCode is 6-digit string
//     if (!/^\d{6}$/.test(companyCode)) {
//       return res.status(400).json({ msg: 'Company code must be a 6-digit number' });
//     }

//     // Validate company exists
//     const company = await Company.findById(companyCode);
//     if (!company) {
//       return res.status(400).json({ msg: 'Invalid company code: No such company found' });
//     }

//     // Check if email already exists for this company
//     const existingEmail = await User.findOne({ email, companyCode });
//     if (existingEmail) {
//       return res.status(409).json({ msg: 'Email already registered under this company' });
//     }

//     // Retry loop to ensure unique 12-digit user ID
//     let userId, idTaken;
//     do {
//       userId = companyCode + generateSuffix(); // 6-digit company code + 6-digit suffix
//       idTaken = await User.findById(userId);
//     } while (idTaken);

//     // Create and save new user
//     const newUser = new User({
//       _id: userId,
//       companyCode,
//       name,
//       email,
//       password,
//       mobile,
//       role: 'unauthorized',
//     });

//     await newUser.save();

//     res.status(201).json({
//       msg: 'Signup request sent for approval',
//     });
//   } catch (err) {
//     console.error('Signup error:', err);
//     res.status(500).json({ msg: 'Internal server error' });
//   }
// };

// module.exports = { signupUser };
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const User = require("../models/User");
const Company = require("../models/Company");

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
    const company = await Company.findById(companyCode);
    if (!company) {
      return res.status(400).json({ msg: "Invalid company code: No such company found" });
    }

    // Check if email already exists for this company
    const existingEmail = await User.findOne({ email, companyCode });
    if (existingEmail) {
      return res.status(409).json({ msg: "Email already registered under this company" });
    }

    // Generate unique 12-digit user ID (6 + 6)
    let userId, idTaken;
    do {
      userId = companyCode + generateSuffix();
      idTaken = await User.findById(userId);
    } while (idTaken);

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new user
    const newUser = new User({
      _id: userId,
      companyCode,
      name,
      email,
      password: hashedPassword,
      mobile,
      role: "unauthorized", // will be changed after admin approval
    });

    await newUser.save();

    // Generate JWT for testing (optional for unauthorized)
    const token = jwt.sign(
      { id: newUser._id, role: newUser.role },
      JWT_SECRET,
      { expiresIn: "7d" } // Set to 7 days
    );

    res.status(201).json({
      msg: "Signup request sent for approval",
      userId: newUser._id,
      token, // return for test purposes
    });

  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ msg: "Internal server error" });
  }
};

module.exports = { signupUser };