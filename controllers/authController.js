const Company = require('../models/Company/Company');
const User = require('../models/User/User');
const UserRole = require('../models/User/UserRole');
const Role = require('../models/RolesAndPermission/Role');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { createSessionForUser, endSessionForUser } = require('../services/sessionService');

// Helper function to fetch user's primary role
const getUserRole = async (userId, companyCode) => {
  try {
    const userRole = await UserRole.findOne({
      where: { userId },
      include: {
        model: Role,
        attributes: ['id', 'name', 'companyId'],
        where: { companyId: companyCode },
      },
    });

    if (userRole && userRole.Role) {
      return userRole.Role.name;
    }
    return 'unauthorized';
  } catch (err) {
    console.error('Error fetching user role:', err);
    return 'unauthorized';
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ msg: 'Email and password are required' });
    }

    // Try to find user in both tables
    let user = await User.findOne({ where: { email } });
    let isCompany = false;

    if (!user) {
      user = await Company.findOne({ where: { email } });
      isCompany = true;
    }

    if (!user) {
      console.log(`User/Company not found with email: ${email}`);
      return res.status(400).json({ msg: 'Invalid credentials' });
    }

    console.log(`Found ${isCompany ? 'company' : 'user'} with email: ${email}`);

    // Get password field if not included (Sequelize excludes it by default for User)
    if (!user.password) {
      user = isCompany 
        ? await Company.findOne({ where: { email } })
        : await User.scope('withPassword').findOne({ where: { email } });
    }

    // Compare password
    let isMatch = false;
    try {
      isMatch = await bcrypt.compare(password, user.password);
      console.log(`Password comparison result: ${isMatch} for email: ${email}`);
    } catch (bcryptErr) {
      // Fall back to plain text comparison for backward compatibility
      console.warn('Bcrypt comparison failed, falling back to plain text:', bcryptErr.message);
      isMatch = password === user.password;
    }

    if (!isMatch) {
      console.log(`Password mismatch for email: ${email}`);
      return res.status(400).json({ msg: 'Invalid credentials' });
    }

    // Approval check for users (not companies)
    let userRole = 'admin';
    if (!isCompany) {
      if (!user.approved) {
        return res.status(403).json({ msg: 'Awaiting admin approval' });
      }
      userRole = await getUserRole(user.id, user.companyCode);
    }

    // Create session after successful login
    await createSessionForUser(user, isCompany);

    // JWT payload
    const payload = {
      id: user.id,
      email: user.email,
      type: isCompany ? 'company' : 'user',
      companyCode: isCompany ? user.id : user.companyCode,
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.json({
      msg: 'Login successful',
      token,
      role: userRole,
      type: isCompany ? 'company' : 'user',
      userId: user.id
    });
  } catch (error) {
    console.error('Login error:', error);
    const isDev = process.env.NODE_ENV !== 'production';
    res.status(500).json({ 
      msg: 'Internal server error',
      ...(isDev && { error: error.message })
    });
  }
};

const logout = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ msg: 'Unauthorized' });
    }
    const { session, uptime } = await endSessionForUser(req.user);
    res.json({
      msg: session ? 'Logout successful' : 'No active session found',
      session,
      uptime,
    });
  } catch (err) {
    console.error('Logout error:', err.message);
    res.status(500).json({ msg: 'Internal server error' });
  }
};

// Verify token without querying DB; returns decoded user data for microservices
const verifyToken = (req, res) => {
  try {
    // req.user is already attached by authMiddleware
    // req.userType is 'user' or 'company'
    // req.userRole is the role
    res.json({
      msg: 'Token valid',
      user: {
        id: req.user.id,
        email: req.user.email,
        name: req.user.name || req.user.companyName,
        type: req.userType,
        role: req.userRole,
        companyCode: req.user.companyCode || req.user.id, // for users or companies
      },
    });
  } catch (err) {
    console.error('Verify token error:', err.message);
    res.status(401).json({ msg: 'Invalid token' });
  }
};

module.exports = {
  login,
  logout,
  verifyToken,
};