const { DataTypes } = require('sequelize');
const { seq } = require('../config/db');

const Notification = seq.define('Notification', {
	id: {
		type: DataTypes.INTEGER,
		primaryKey: true,
		autoIncrement: true,
	},
	companyCode: {
		type: DataTypes.STRING(6),
		allowNull: false,
		references: {
			model: 'companies',
			key: 'id',
		},
	},
	type: {
		type: DataTypes.ENUM('user_approval', 'comment', 'file_upload', 'task_assigned', 'other'),
		defaultValue: 'other',
	},
	userId: {
		type: DataTypes.INTEGER,
		allowNull: true,
		references: {
			model: 'users',
			key: 'id',
		},
	},
	userName: {
		type: DataTypes.STRING,
		allowNull: false,
	},
	userEmail: {
		type: DataTypes.STRING,
		allowNull: true,
	},
	message: {
		type: DataTypes.TEXT,
		allowNull: false,
	},
	status: {
		type: DataTypes.ENUM('pending', 'approved', 'rejected', 'read'),
		defaultValue: 'pending',
	},
	isRead: {
		type: DataTypes.BOOLEAN,
		defaultValue: false,
	},
}, {
	timestamps: true,
	tableName: 'notifications',
});

module.exports = Notification;
