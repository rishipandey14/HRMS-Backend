const Company = require('../models/Company');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { createSessionForUser, endSessionForUser } = require('../services/sessionService');

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

    // If normal user and not approved
    if (!isCompany && user.role === 'unauthorized') {
      return res.status(403).json({ msg: 'Awaiting admin approval' });
    }

    // Create session after successful login
    await createSessionForUser(user, isCompany);

    // JWT payload
    const payload = {
      id: user.id,
      role: user.role,
      email: user.email,
      type: isCompany ? 'company' : 'user',
      companyCode: isCompany ? user.id : user.companyCode,
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.json({
      msg: 'Login successful',
      token,
      role: user.role,
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
    res.json({ msg: 'Logout successful', session, uptime });
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