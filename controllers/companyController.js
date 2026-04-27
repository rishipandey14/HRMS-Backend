const Company = require("../models/Company/Company");
const User = require("../models/User/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { seq } = require('../config/db');
const {
  createTrialSubscription,
  getSubscriptionContext,
} = require('../services/subscriptionService');
const { seedSystemRolesForCompany, createSAdminRoleForCompany } = require('../services/rbacService');

const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret"; // Use .env in production

// Generate unique 6-digit company ID
const generateCompanyId = async () => {
  let newId;
  let exists = true;
  while (exists) {
    newId = Math.floor(100000 + Math.random() * 900000).toString();
    const existing = await Company.findByPk(newId);
    if (!existing) exists = false;
  }
  return newId;
};

// Company signup controller
const signupCompany = async (req, res) => {
  const transaction = await seq.transaction();

  try {
    const { companyName, email, address, companyType, password } = req.body;

    // Check if company already exists
    const existingCompany = await Company.findOne({ where: { email } });
    if (existingCompany) {
      await transaction.rollback();
      return res.status(400).json({ msg: "Company already exists" });
    }

    // Generate unique company ID
    const companyId = await generateCompanyId();

    // Create and save new company
    // Password will be hashed automatically by the Company model's beforeCreate hook
    const newCompany = await Company.create({
      id: companyId,
      companyName,
      email,
      address,
      companyType,
      password, // Pass plain password - model will hash it
      role: "admin"
    }, { transaction });

    const subscription = await createTrialSubscription(newCompany.id, transaction, newCompany.createdAt);

    await transaction.commit();

    await seedSystemRolesForCompany(newCompany.id);
    
    // Create sAdmin role with all permissions
    await createSAdminRoleForCompany(newCompany.id);

    const subscriptionContext = await getSubscriptionContext(newCompany.id);

    // Generate JWT token
    const token = jwt.sign(
      {
        id: newCompany.id,
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
        id: newCompany.id,
        email: newCompany.email,
        companyName: newCompany.companyName,
        role: newCompany.role
      },
      subscription: subscriptionContext ? subscriptionContext.serialized : null,
    });
  } catch (error) {
    await transaction.rollback().catch(() => {});
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
      companyId = req.user.id;
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
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 50;
    const offset = (page - 1) * limit;
    const includeAllRoles = String(req.query.includeAllRoles || 'false').toLowerCase() === 'true';

    // Default behavior keeps existing employee-only listing for existing screens.
    // Access control can opt into full list to reassign any role.
    const userFilter = includeAllRoles
      ? { companyCode: companyId }
      : { companyCode: companyId, role: 'employee' };
    const {rows: users, count: total} = await User.findAndCountAll({
      where: userFilter,
      attributes: { exclude: ['password'] },
      order: [['createdAt', 'DESC']],
      offset: offset,
      limit
    });

    return res.json({
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