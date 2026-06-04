const { DataTypes } = require('sequelize');
const { seq } = require('../../config/db');

const SubscriptionAddon = seq.define('SubscriptionAddon', {
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
	addonCode: {
		type: DataTypes.STRING,
		allowNull: false,
		references: {
			model: 'plan_addons',
			key: 'code',
		},
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
	quantityPurchased: {
		type: DataTypes.INTEGER,
		allowNull: false,
		defaultValue: 0,
	},
	status: {
		type: DataTypes.ENUM('active', 'archived'),
		defaultValue: 'active',
	},
}, {
	timestamps: true,
	tableName: 'subscription_addons',
});

module.exports = SubscriptionAddon;

