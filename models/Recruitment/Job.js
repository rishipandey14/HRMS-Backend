const { DataTypes } = require('sequelize');
const { seq } = require('../../config/db');

const Job = seq.define('Job', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  companyCode: {
    type: DataTypes.STRING(6),
    allowNull: false,
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  department: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  type: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  slug: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  location: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  salary: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  status: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'open'
  },
  requirements: {
    type: DataTypes.JSON,
    allowNull: true,
  },
  responsibilities: {
    type: DataTypes.JSON,
    allowNull: true,
  },
  required_skills: {
    type: DataTypes.JSON,
    allowNull: true,
  },
  preferred_skills: {
    type: DataTypes.JSON,
    allowNull: true,
  },
  min_experience: {
    type: DataTypes.FLOAT,
    allowNull: true,
  },
  min_cgpa: {
    type: DataTypes.FLOAT,
    allowNull: true,
  },
  is_public: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  }
  ,
  createdBy: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id',
    },
  }
}, {
  timestamps: true,
  tableName: 'jobs'
});

module.exports = Job;
