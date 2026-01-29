const { DataTypes } = require('sequelize');
const { seq } = require('../config/db');

const Task = seq.define('Task', {
  id: {
    type: DataTypes.STRING,
    primaryKey: true,
    allowNull: false,
  },
  projectId: {
    type: DataTypes.STRING,
    allowNull: false,
    references: {
      model: 'projects',
      key: 'id',
    },
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false,
    set(value) {
      this.setDataValue('title', value ? value.trim() : '');
    },
  },
  assignedTo: {
    type: DataTypes.JSON,
    defaultValue: [],
    get() {
      const value = this.getDataValue('assignedTo');
      return Array.isArray(value) ? value : [];
    },
  },
  status: {
    type: DataTypes.ENUM('Not Started', 'In Progress', 'Completed'),
    defaultValue: 'Not Started',
    allowNull: false,
  },
  assignedDate: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  startingDate: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  deadline: {
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
  tableName: 'tasks',
  indexes: [
    { fields: ['projectId'] },
    { fields: ['status'] },
    { fields: ['deadline'] },
  ],
  hooks: {
    beforeValidate: (task) => {
      if (task.deadline && task.startingDate && task.deadline < task.startingDate) {
        throw new Error('Deadline cannot be before starting date.');
      }
    },
    beforeDestroy: async (task) => {
      const Update = require('./Update');
      await Update.destroy({ where: { taskId: task.id } });
    },
  },
});

module.exports = Task;
