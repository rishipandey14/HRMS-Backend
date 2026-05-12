const { DataTypes } = require('sequelize');
const { seq } = require('../../config/db');

const Candidate = seq.define('Candidate', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  companyCode: {
    type: DataTypes.STRING(6),
    allowNull: false,
  },
  jobId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'jobs',
      key: 'id'
    }
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  coverLetter: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  sourceCandidateId: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  skills: {
    type: DataTypes.JSON,
    allowNull: true,
  },
  experience_years: {
    type: DataTypes.FLOAT,
    allowNull: true,
  },
  education: {
    type: DataTypes.JSON,
    allowNull: true,
  },
  score: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  resume_url: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  status: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'applied',
  }
}, {
  timestamps: true,
  tableName: 'candidates'
});

module.exports = Candidate;
