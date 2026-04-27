const { DataTypes } = require('sequelize');
const { seq } = require('../../config/db');

const RolePermission = seq.define('RolePermission', {
	id: {
		type: DataTypes.INTEGER,
		primaryKey: true,
		autoIncrement: true,
	},
	roleId: {
		type: DataTypes.INTEGER,
		allowNull: false,
		references: {
			model: 'roles',
			key: 'id',
		},
	},
	permissionId: {
		type: DataTypes.INTEGER,
		allowNull: false,
		references: {
			model: 'permissions',
			key: 'id',
		},
	},
}, {
	timestamps: true,
	tableName: 'role_permissions',
	indexes: [
		{ fields: ['roleId'] },
		{ fields: ['permissionId'] },
		{ unique: true, fields: ['roleId', 'permissionId'], name: 'role_permissions_unique_pair' },
	],
});

module.exports = RolePermission;

