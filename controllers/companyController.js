const Company = require("../models/Company");
const User = require("../models/User");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret"; // Use .env in production

// Generate unique 6-digit company ID
const generateCompanyId = async () => {
  let newId;
  let exists = true;
  while (exists) {
    newId = Math.floor(100000 + Math.random() * 900000).toString();
    const existing = await Company.findById(newId);
    if (!existing) exists = false;
  }
  return newId;
};

// Company signup controller
const signupCompany = async (req, res) => {
  try {
    const { companyName, email, address, companyType, password } = req.body;

    // Check if company already exists
    const existingCompany = await Company.findOne({ email });
    if (existingCompany) {
      return res.status(400).json({ msg: "Company already exists" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate unique company ID
    const companyId = await generateCompanyId();

    // Create and save new company
    const newCompany = new Company({
      _id: companyId,
      companyName,
      email,
      address,
      companyType,
      password: hashedPassword,
      role: "admin" // default role
    });

    await newCompany.save();

    // Generate JWT token
    const token = jwt.sign(
      {
        id: newCompany._id,
        role: newCompany.role,
        type: 'company',
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    // Respond with success and token
    res.status(201).json({
      msg: "Company registered successfully",
      token,
      company: {
        _id: newCompany._id,
        email: newCompany.email,
        companyName: newCompany.companyName,
        role: newCompany.role
      }
    });
  } catch (error) {
    res.status(500).json({ msg: "Error registering company", error: error.message });
  }
};

// List all users associated with the logged-in company
const listCompanyUsers = async (req, res) => {
  try {
    // Allow both company accounts and regular users to view company members
    let companyId;

    if (req.userType === 'company') {
      // Company admin - use their company ID
      companyId = req.user._id;
    } else if (req.userType === 'user') {
      // Regular user - use their company code from the user document
      companyId = req.user.companyCode;
      if (!companyId) {
        return res.status(403).json({ msg: 'User is not associated with any company' });
      }
    } else {
      return res.status(403).json({ msg: 'Access denied: Invalid user type' });
    }

    // Optional pagination
    const page = parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '50', 10);
    const skip = (page - 1) * limit;

    // Fetch only authorized regular users of the company
    const userFilter = { companyCode: companyId, role: 'user' };
    const [users, total] = await Promise.all([
      User.find(userFilter)
        .select('-password')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      User.countDocuments(userFilter)
    ]);

    res.json({
      page,
      limit,
      total,
      users,
    });
  } catch (error) {
    console.error('listCompanyUsers error:', error);
    res.status(500).json({ msg: 'Failed to list company users' });
  }
};

module.exports = { signupCompany, listCompanyUsers };