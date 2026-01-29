const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');
const { seq } = require('../config/db');

const User = seq.define('User', {
	id: {
		type: DataTypes.INTEGER,
		primaryKey: true,
		autoIncrement: true,
		allowNull: false,
	},
	name: {
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
	password: {
		type: DataTypes.STRING,
		allowNull: false,
	},
	mobile: {
		type: DataTypes.STRING,
		allowNull: true,
	},
	companyCode: {
		type: DataTypes.STRING(6),
		allowNull: true,
		references: {
			model: 'companies',
			key: 'id',
		},
		onDelete: 'CASCADE',
		onUpdate: 'CASCADE',
	},
	role: {
		type: DataTypes.ENUM('employee', 'manager', 'admin', 'sadmin', 'unauthorized'),
		defaultValue: 'unauthorized',
	},
}, {
	timestamps: true,
	tableName: 'users',
	defaultScope: {
		attributes: { exclude: ['password'] }, // Don't return password by default
	},
	scopes: {
		withPassword: {
			attributes: { include: ['password'] },
		},
	},
	hooks: {
		// Hash password before creating
		beforeCreate: async (user) => {
			if (user.password) {
				const salt = await bcrypt.genSalt(10);
				user.password = await bcrypt.hash(user.password, salt);
			}
		},
		// Hash password before updating if changed
		beforeUpdate: async (user) => {
			if (user.changed('password')) {
				const salt = await bcrypt.genSalt(10);
				user.password = await bcrypt.hash(user.password, salt);
			}
		},
		// Cascade delete related records
		beforeDestroy: async (user) => {
			const Session = require('./Session');
			const Uptime = require('./Uptime');
			
			await Session.destroy({ where: { userId: user.id } });
			await Uptime.destroy({ where: { userId: user.id } });
		},
	},
});

module.exports = User;