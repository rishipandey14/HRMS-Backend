// const jwt = require('jsonwebtoken');

// const authMiddleware = (req, res, next) => {
//   const token = req.header('Authorization');
//   if (!token) return res.status(401).json({ msg: 'No token, authorization denied' });

//   try {
//     const decoded = jwt.verify(token, process.env.JWT_SECRET);
//     req.user = decoded;
//     next();
//   } catch (err) {
//     res.status(401).json({ msg: 'Token is not valid' });
//   }
// };

// module.exports = authMiddleware;
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Company = require('../models/Company');

const authMiddleware = async (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ msg: 'No token, authorization denied' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Attach user/company details to req.user
    let user;
    if (decoded.type === 'company') {
      user = await Company.findByPk(decoded.id, { attributes: { exclude: ['password'] } });
    } else {
      user = await User.findByPk(decoded.id, { attributes: { exclude: ['password'] } });
    }

    if (!user) return res.status(401).json({ msg: 'User not found' });

    // Normalize common fields on req.user
    req.user = user.get ? user.get({ plain: true }) : user;
    req.user.companyCode = decoded.companyCode || req.user.companyCode || req.user.companyId || req.user.id;

    req.userType = decoded.type; // 'user' or 'company'
    req.userRole = decoded.role; // 'admin', 'sadmin', etc.

    next();
  } catch (err) {
    console.error('Auth error:', err.message);
    return res.status(401).json({ msg: 'Token is not valid' });
  }
};

module.exports = authMiddleware;