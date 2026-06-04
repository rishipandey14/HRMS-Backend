const { DataTypes } = require('sequelize');
const { seq } = require('../../config/db');

const Role = seq.define('Role', {
	id: {
		type: DataTypes.INTEGER,
		primaryKey: true,
		autoIncrement: true,
	},
	companyId: {
		type: DataTypes.STRING(6),
		allowNull: false,
		references: {
			model: 'companies',
			key: 'id',
		},
	},
	name: {
		type: DataTypes.STRING,
		allowNull: false,
	},
	parentRoleId: {
		type: DataTypes.INTEGER,
		allowNull: true,
		references: {
			model: 'roles',
			key: 'id',
		},
		onDelete: 'SET NULL',
		onUpdate: 'CASCADE',
	},
	isSystem: {
		type: DataTypes.BOOLEAN,
		allowNull: false,
		defaultValue: false,
	},
	isCustom: {
		type: DataTypes.BOOLEAN,
		allowNull: false,
		defaultValue: true,
	},
}, {
	timestamps: true,
	tableName: 'roles',
	indexes: [
		{ fields: ['companyId'] },
		{ fields: ['name'] },
		{ fields: ['parentRoleId'] },
		{ unique: true, fields: ['companyId', 'name'], name: 'roles_company_name_unique' },
	],
});

module.exports = Role;

