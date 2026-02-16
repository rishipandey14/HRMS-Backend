const { DataTypes } = require('sequelize');
const { seq } = require('../config/db');

const UserRole = seq.define('UserRole', {
	id: {
		type: DataTypes.INTEGER,
		primaryKey: true,
		autoIncrement: true,
	},
	userId: {
		type: DataTypes.INTEGER,
		allowNull: false,
		references: {
			model: 'users',
			key: 'id',
		},
		onDelete: 'CASCADE',
		onUpdate: 'CASCADE',
	},
	roleId: {
		type: DataTypes.INTEGER,
		allowNull: false,
		references: {
			model: 'roles',
			key: 'id',
		},
		onDelete: 'CASCADE',
		onUpdate: 'CASCADE',
	},
}, {
	timestamps: true,
	tableName: 'user_roles',
	indexes: [
		{ fields: ['userId'] },
		{ fields: ['roleId'] },
	],
});

module.exports = UserRole;
