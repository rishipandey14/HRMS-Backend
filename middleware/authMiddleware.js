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
const User = require('../models/User/User');
const Company = require('../models/Company/Company');
const UserRole = require('../models/User/UserRole');
const Role = require('../models/RolesAndPermission/Role');

// Helper function to fetch user's primary role
const getUserPrimaryRole = async (userId, companyCode) => {
  try {
    const userRole = await UserRole.findOne({
      where: { userId },
      include: {
        model: Role,
        attributes: ['id', 'name', 'companyId'],
        where: { companyId: companyCode },
      },
      attributes: ['roleId'],
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

    const tokenRole = String(decoded.role || decoded.userRole || '').toLowerCase();
    const legacyUserRole = String(req.user.role || '').toLowerCase();
    
    // Fetch user role from UserRole and Role models, but keep legacy/token role fallbacks.
    if (req.userType === 'user') {
      if (tokenRole) {
        req.userRole = tokenRole;
      } else if (legacyUserRole) {
        req.userRole = legacyUserRole;
      }

      req.userRole = await getUserPrimaryRole(decoded.id, req.user.companyCode);

      if (req.userRole === 'unauthorized' && (tokenRole || legacyUserRole)) {
        req.userRole = tokenRole || legacyUserRole;
      }
    } else {
      // Company users have role 'admin'
      req.userRole = tokenRole || legacyUserRole || 'admin';
    }

    next();
  } catch (err) {
    console.error('Auth error:', err.message);
    return res.status(401).json({ msg: 'Token is not valid' });
  }
};

module.exports = authMiddleware;