const { DataTypes } = require('sequelize');
const { seq } = require('../config/db');

const CompanyPlanOverride = seq.define('CompanyPlanOverride', {
	companyId: {
		type: DataTypes.STRING(6),
		primaryKey: true,
		allowNull: false,
		references: {
			model: 'companies',
			key: 'id',
		},
	},
	maxEmployees: {
		type: DataTypes.INTEGER,
		allowNull: true,
	},
	featureFlags: {
		type: DataTypes.JSON,
		allowNull: false,
		defaultValue: {},
	},
}, {
	timestamps: true,
	tableName: 'company_plan_overrides',
});

module.exports = CompanyPlanOverride;
