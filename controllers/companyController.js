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
    // Ensure the requester is a company account
    if (req.userType !== 'company') {
      return res.status(403).json({ msg: 'Only company accounts can list users' });
    }

    const companyId = req.user._id; // 6-digit company code

    // Optional pagination
    const page = parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '50', 10);
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      User.find({ companyCode: companyId, role: 'user' })
        .select('-password')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      User.countDocuments({ companyCode: companyId, role: 'user' })
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