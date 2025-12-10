// const Company = require('../models/Company');
// const User = require('../models/User');
// const jwt = require('jsonwebtoken');

// const login = async (req, res) => {
//   const { email, password } = req.body;

//   let user = await User.findOne({ email }) || await Company.findOne({ email });
//   if (!user) return res.status(400).json({ msg: 'Invalid user' });

//   const isMatch = password === user.password;
//   if (!isMatch) return res.status(400).json({ msg: 'Invalid credentials' });

//   if (user.role === 'unauthorized') return res.status(403).json({ msg: 'Awaiting admin approval' });

//   const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
//   res.json({ token, role: user.role });
// };

// module.exports = { login };
const Company = require('../models/Company');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { createSessionForUser, endSessionForUser } = require('../services/sessionService');

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Try to find user in both collections
    let user = await User.findOne({ email });
    let isCompany = false;

    if (!user) {
      user = await Company.findOne({ email });
      isCompany = true;
    }

    if (!user) {
      return res.status(400).json({ msg: 'Invalid credentials' });
    }

    // Compare hashed password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ msg: 'Invalid credentials' });
    }

    // If normal user and not approved
    if (!isCompany && user.role === 'unauthorized') {
      return res.status(403).json({ msg: 'Awaiting admin approval' });
    }

    // Create session after successful login
    await createSessionForUser(user);

    // JWT payload
    const payload = {
      id: user._id,
      role: user.role,
      email: user.email,
      type: isCompany ? 'company' : 'user',
      companyCode: isCompany ? user._id : user.companyCode,
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.json({
      msg: 'Login successful',
      token,
      role: user.role,
      type: isCompany ? 'company' : 'user',
      userId: user._id
    });
  } catch (error) {
    console.error('Login error:', error.message);
    res.status(500).json({ msg: 'Internal server error' });
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
        id: req.user._id,
        email: req.user.email,
        name: req.user.name || req.user.companyName,
        type: req.userType,
        role: req.userRole,
        companyCode: req.user.companyCode || req.user._id, // for users or companies
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