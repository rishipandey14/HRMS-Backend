const { DataTypes } = require('sequelize');
const { seq } = require('../../config/db');

const CompanySubscription = seq.define('CompanySubscription', {
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
	planId: {
		type: DataTypes.STRING,
		allowNull: false,
		references: {
			model: 'plans',
			key: 'id',
		},
	},
	status: {
		type: DataTypes.ENUM('active', 'canceled', 'expired', 'grace'),
		defaultValue: 'active',
	},
	startsAt: {
		type: DataTypes.DATE,
		allowNull: false,
		defaultValue: DataTypes.NOW,
	},
	endsAt: {
		type: DataTypes.DATE,
		allowNull: true,
	},
	graceUntil: {
		type: DataTypes.DATE,
		allowNull: true,
	},
	autoRenew: {
		type: DataTypes.BOOLEAN,
		allowNull: false,
		defaultValue: true,
	},
}, {
	timestamps: true,
	tableName: 'company_subscriptions',
	indexes: [
		{ fields: ['companyId'] },
		{ fields: ['planId'] },
		{ fields: ['status'] },
	],
});

module.exports = CompanySubscription;

