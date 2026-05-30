const { DataTypes } = require('sequelize');
const { seq } = require('../../config/db');

const Holiday = seq.define('Holiday', {
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
		onDelete: 'CASCADE',
		onUpdate: 'CASCADE',
	},
	name: {
		type: DataTypes.STRING,
		allowNull: false,
	},
	dateLabel: {
		type: DataTypes.STRING,
		allowNull: false,
	},
	startDate: {
		type: DataTypes.DATEONLY,
		allowNull: true,
	},
	endDate: {
		type: DataTypes.DATEONLY,
		allowNull: true,
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
	tableName: 'holidays',
	indexes: [
		{ fields: ['companyId'] },
		{ fields: ['companyId', 'dateLabel'] },
	],
});

module.exports = Holiday;