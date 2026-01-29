const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');
const { seq } = require('../config/db');

const Company = seq.define('Company', {
	id: {
		type: DataTypes.STRING(6),
		primaryKey: true,
		allowNull: false,
	},
	companyName: {
		type: DataTypes.STRING,
		allowNull: false,
	},
	email: {
		type: DataTypes.STRING,
		unique: true,
		allowNull: false,
		validate: {
			isEmail: true,
		},
	},
	address: {
		type: DataTypes.STRING,
		allowNull: true,
	},
	companyType: {
		type: DataTypes.STRING,
		allowNull: true,
	},
	password: {
		type: DataTypes.STRING,
		allowNull: false,
	},
	logo: {
		type: DataTypes.STRING,
		allowNull: true,
	},
	role: {
		type: DataTypes.ENUM('admin', 'sadmin'),
		defaultValue: 'admin',
	},
}, {
	timestamps: true,
	tableName: 'companies',
	hooks: {
		// Hash password before creating
		beforeCreate: async (company) => {
			if (company.password) {
				const salt = await bcrypt.genSalt(10);
				company.password = await bcrypt.hash(company.password, salt);
			}
		},
		// Hash password before updating if changed
		beforeUpdate: async (company) => {
			if (company.changed('password')) {
				const salt = await bcrypt.genSalt(10);
				company.password = await bcrypt.hash(company.password, salt);
			}
		},
		// Cascade delete related records
		beforeDestroy: async (company) => {
			const User = require('./User');
			const Project = require('./Project');
			const Uptime = require('./Uptime');
			
			await User.destroy({ where: { companyCode: company.id } });
			await Project.destroy({ where: { companyId: company.id } });
			await Uptime.destroy({ where: { companyId: company.id } });
		},
	},
});

module.exports = Company;
