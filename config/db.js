require("dotenv").config();
const { Sequelize } = require("sequelize");

// Prefer DB_URL but fall back to DB_URI to avoid mismatched env var names
const enableSqlLogging = process.env.SQL_LOGGING === "true";
const seq = new Sequelize(process.env.DB_URL, {
  dialect: "mysql",
  logging: false,
  dialectOptions: {
    ssl: {
      rejectUnauthorized: false,
    },
  },
});

const resolveSyncOptions = () => {
  // Supported values: none | safe | alter | force
  const syncMode = (process.env.SEQUELIZE_SYNC_MODE || "none").toLowerCase();

  if (syncMode === "none") {
    return null;
  }

  if (syncMode === "alter") {
    return { alter: true };
  }

  if (syncMode === "force") {
    return { force: true };
  }

  return { alter: false };
};

const ensureRoleHierarchySchema = async () => {
  const queryInterface = seq.getQueryInterface();
  const roleTable = await queryInterface.describeTable('roles');

  if (roleTable.parentRoleId) {
    return;
  }

  await queryInterface.addColumn('roles', 'parentRoleId', {
    type: Sequelize.INTEGER,
    allowNull: true,
    references: {
      model: 'roles',
      key: 'id',
    },
    onDelete: 'SET NULL',
    onUpdate: 'CASCADE',
  });

  console.log('Added missing roles.parentRoleId column');
};

const ensureUserRoleColumnSize = async () => {
  const queryInterface = seq.getQueryInterface();
  const userTable = await queryInterface.describeTable('users');
  const roleColumn = userTable.role;

  if (!roleColumn) {
    return;
  }

  // Check if the column is too small (typically VARCHAR(1) or VARCHAR(5))
  // Role names like 'senior_manager' need at least 15 chars, so expand to 50 to be safe
  if (roleColumn.type && roleColumn.type.includes('VARCHAR') && roleColumn.type.match(/\((\d+)\)/)) {
    const match = roleColumn.type.match(/\((\d+)\)/);
    const currentLength = parseInt(match[1], 10);
    if (currentLength < 50) {
      await queryInterface.changeColumn('users', 'role', {
        type: Sequelize.STRING(50),
        defaultValue: 'unauthorized',
      });
      console.log(`Expanded users.role column from VARCHAR(${currentLength}) to VARCHAR(50)`);
    }
  }
};

const ensureHolidayRangeSchema = async () => {
  const queryInterface = seq.getQueryInterface();
  const holidayTable = await queryInterface.describeTable('holidays');

  if (!holidayTable.startDate) {
    await queryInterface.addColumn('holidays', 'startDate', {
      type: Sequelize.DATEONLY,
      allowNull: true,
    });
    console.log('Added missing holidays.startDate column');
  }

  if (!holidayTable.endDate) {
    await queryInterface.addColumn('holidays', 'endDate', {
      type: Sequelize.DATEONLY,
      allowNull: true,
    });
    console.log('Added missing holidays.endDate column');
  }
};

const connectDB = async () => {
  try {
    await seq.authenticate();
    console.log('DataBase connected');
    
    // Import all models
    const Company = require('../models/Company/Company');
    const User = require('../models/User/User');
    const Project = require('../models/Project/Project');
    const Task = require('../models/Project/Task');
    const Update = require('../models/Project/Update');
    const Session = require('../models/Others/Session');
    const Uptime = require('../models/Others/Uptime');
    const Notification = require('../models/Others/Notification');
    const Plans = require('../models/Plans/Plans');
    const CompanySubscription = require('../models/Plans/CompanySubscription');
    const CompanyPlanOverride = require('../models/Plans/CompanyPlanOverride');
    const PlanAddon = require('../models/Plans/PlanAddon');
    const SubscriptionAddon = require('../models/Plans/SubscriptionAddon');
    const Role = require('../models/RolesAndPermission/Role');
    const Permission = require('../models/RolesAndPermission/Permission');
    const RolePermission = require('../models/RolesAndPermission/RolePermission');
    const UserRole = require('../models/User/UserRole');
    const Holiday = require('../models/Others/Holiday');
    const Job = require('../models/Recruitment/Job');
    const Candidate = require('../models/Recruitment/Candidate');

    // RBAC associations
    Role.belongsTo(Company, { foreignKey: 'companyId' });
    Company.hasMany(Role, { foreignKey: 'companyId' });

    Role.belongsToMany(Permission, {
      through: RolePermission,
      foreignKey: 'roleId',
      otherKey: 'permissionId',
      as: 'permissions',
    });
    Permission.belongsToMany(Role, {
      through: RolePermission,
      foreignKey: 'permissionId',
      otherKey: 'roleId',
      as: 'roles',
    });

    Role.belongsTo(Role, { foreignKey: 'parentRoleId', as: 'parentRole' });
    Role.hasMany(Role, { foreignKey: 'parentRoleId', as: 'childRoles' });

    User.belongsToMany(Role, {
      through: UserRole,
      foreignKey: 'userId',
      otherKey: 'roleId',
      as: 'rbacRoles',
    });
    Role.belongsToMany(User, {
      through: UserRole,
      foreignKey: 'roleId',
      otherKey: 'userId',
      as: 'users',
    });
    UserRole.belongsTo(Role, { foreignKey: 'roleId' });
    UserRole.belongsTo(User, { foreignKey: 'userId' });
    Role.hasMany(UserRole, { foreignKey: 'roleId' });
    User.hasMany(UserRole, { foreignKey: 'userId' });

    // Holiday model has no associations beyond company/user foreign keys
      // Removed duplicate holiday sync
    
    // Chat models
    const Chat = require('../models/Chat/Chat');
    const Message = require('../models/Chat/Message');
    const ChatMember = require('../models/Chat/ChatMember');
    const ChatAdmin = require('../models/Chat/ChatAdmin');
    const ChatArchived = require('../models/Chat/ChatArchived');
    const ChatMuted = require('../models/Chat/ChatMuted');
    const MessageReadStatus = require('../models/Chat/MessageReadStatus');
    const PinnedMessage = require('../models/Chat/PinnedMessage');
    
    // Set up chat and message associations
    if (Chat.setupAssociations) Chat.setupAssociations();
    if (Message.setupAssociations) Message.setupAssociations();
    
    // // Keep schema sync opt-in to avoid expensive startup DDL on every boot.
    // await ensureRoleHierarchySchema();
    // Note: ensureUserRoleColumnSize() no longer needed - role field removed from User model
    // and role is now managed through UserRole model
    const syncOptions = resolveSyncOptions();
    if (syncOptions) {
      await seq.sync(syncOptions);
      console.log('All models synchronized', syncOptions);
    } else {
      console.log('Skipped Sequelize sync (SEQUELIZE_SYNC_MODE=none)');
    }

    // Run migrations AFTER tables exist
    await ensureRoleHierarchySchema();

    // Ensure the holiday table exists for the leave-management holiday panel.
    await Holiday.sync();
    const queryInterface = seq.getQueryInterface();
    const notificationTable = await queryInterface.describeTable('notifications').catch(() => null);
    if (notificationTable) {
      if (!notificationTable.targetUserId) {
        await queryInterface.addColumn('notifications', 'targetUserId', {
          type: Sequelize.INTEGER,
          allowNull: true,
        });
      }
      if (!notificationTable.targetRole) {
        await queryInterface.addColumn('notifications', 'targetRole', {
          type: Sequelize.STRING,
          allowNull: true,
        });
      }
      if (!notificationTable.visibleUserIds) {
        await queryInterface.addColumn('notifications', 'visibleUserIds', {
          type: Sequelize.JSON,
          allowNull: true,
        });
      }
      if (!notificationTable.visibleRoleNames) {
        await queryInterface.addColumn('notifications', 'visibleRoleNames', {
          type: Sequelize.JSON,
          allowNull: true,
        });
      }
      if (!notificationTable.workflowStage) {
        await queryInterface.addColumn('notifications', 'workflowStage', {
          type: Sequelize.STRING,
          allowNull: true,
        });
      }
      if (!notificationTable.decisionBy) {
        await queryInterface.addColumn('notifications', 'decisionBy', {
          type: Sequelize.INTEGER,
          allowNull: true,
        });
      }
      if (!notificationTable.decisionReason) {
        await queryInterface.addColumn('notifications', 'decisionReason', {
          type: Sequelize.TEXT,
          allowNull: true,
        });
      }
      if (!notificationTable.payload) {
        await queryInterface.addColumn('notifications', 'payload', {
          type: Sequelize.JSON,
          allowNull: true,
        });
      }
    }
    await ensureHolidayRangeSchema();

    // Recruitment models are already required above so sync can create tables.
    
    // Set auto-increment start value for User id to 100000
    await seq.query('ALTER TABLE users AUTO_INCREMENT=100000;').catch(() => {
      // If table doesn't exist yet, it will be created with proper values
    });
    
  } catch (err) {
    console.error('Unable to connect to the database:', err);
    if (process.env.NODE_ENV === 'test') {
      throw err;
    }
    process.exit(1);
  }
};
module.exports = {connectDB, seq};