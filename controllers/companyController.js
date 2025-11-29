const Company = require("../models/Company");
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
        _id: newCompany._id,
        role: newCompany.role,
        companyCode: newCompany._id
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

module.exports = { signupCompany };