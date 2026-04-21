const { DataTypes } = require('sequelize');
const { seq } = require('../../config/db');

const PlanAddon = seq.define('PlanAddon', {
	id: {
		type: DataTypes.INTEGER,
		primaryKey: true,
		autoIncrement: true,
	},
	code: {
		type: DataTypes.STRING,
		allowNull: false,
		allowNull: false,
	},
	name: {
		type: DataTypes.STRING,
		allowNull: false,
	},
	unitPriceCents: {
		type: DataTypes.INTEGER,
		allowNull: false,
		defaultValue: 0,
	},
	currency: {
		type: DataTypes.STRING(3),
		allowNull: false,
		defaultValue: 'INR',
	},
	unit: {
		type: DataTypes.STRING,
		allowNull: false,
	},
	status: {
		type: DataTypes.ENUM('active', 'archived'),
		defaultValue: 'active',
	},
	description: {
		type: DataTypes.TEXT,
		allowNull: true,
	},
}, {
	timestamps: true,
	tableName: 'plan_addons',
		indexes: [
			{
				unique: true,
				fields: ['code'],
				name: 'plan_addons_code_unique'
			}
		],
});

module.exports = PlanAddon;
