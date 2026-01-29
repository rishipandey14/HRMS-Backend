const { DataTypes } = require('sequelize');
const { seq } = require('../config/db');

const Project = seq.define('Project', {
  id: {
    type: DataTypes.STRING,
    primaryKey: true,
    allowNull: false,
  },
  companyId: {
    type: DataTypes.STRING(6),
    allowNull: false,
    references: {
      model: 'companies',
      key: 'id',
    },
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  participants: {
    type: DataTypes.JSON,
    defaultValue: [],
    get() {
      const value = this.getDataValue('participants');
      return Array.isArray(value) ? value : [];
    },
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  startDate: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  endDate: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  createdBy: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id',
    },
  },
  updatedBy: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id',
    },
  },
}, {
  timestamps: true,
  tableName: 'projects',
  hooks: {
    beforeDestroy: async (project) => {
      const Task = require('./Task');
      await Task.destroy({ where: { projectId: project.id } });
    },
  },
});

module.exports = Project;

