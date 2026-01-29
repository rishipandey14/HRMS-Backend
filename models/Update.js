const { DataTypes } = require('sequelize');
const { seq } = require('../config/db');

const Update = seq.define('Update', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  taskId: {
    type: DataTypes.STRING,
    allowNull: false,
    references: {
      model: 'tasks',
      key: 'id',
    },
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  },
  date: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  note: {
    type: DataTypes.STRING(500),
    defaultValue: '',
    set(value) {
      this.setDataValue('note', value ? value.trim() : '');
    },
  },
  status: {
    type: DataTypes.ENUM('Not Started', 'In Progress', 'Completed'),
    allowNull: false,
  },
  createdBy: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id',
    },
    onDelete: 'SET NULL',
    onUpdate: 'CASCADE',
  },
  updatedBy: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id',
    },
    onDelete: 'SET NULL',
    onUpdate: 'CASCADE',
  },
}, {
  timestamps: true,
  tableName: 'updates',
  indexes: [
    { fields: ['taskId'] },
    { fields: ['date'] },
  ],
});

module.exports = Update;
