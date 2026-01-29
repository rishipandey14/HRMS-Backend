const { DataTypes } = require('sequelize');
const { seq } = require('../config/db');

const defaultDaily = () => ({ Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0, Sun: 0 });

const Uptime = seq.define('Uptime', {
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
	companyId: {
		type: DataTypes.STRING(6),
		allowNull: true,
		references: {
			model: 'companies',
			key: 'id',
		},
		onDelete: 'CASCADE',
		onUpdate: 'CASCADE',
	},
	week: {
		type: DataTypes.STRING,
		allowNull: false,
		validate: {
			isValidWeek(value) {
				if (!/^\d{4}-W\d{2}$/.test(value)) {
					throw new Error('Week format should be YYYY-Www');
				}
			},
		},
	},
	dailyHours: {
		type: DataTypes.JSON,
		defaultValue: defaultDaily(),
		get() {
			const value = this.getDataValue('dailyHours');
			return value || defaultDaily();
		},
	},
}, {
	timestamps: true,
	tableName: 'uptimes',
	indexes: [
		{
			unique: true,
			fields: ['userId', 'week'],
		},
	],
	hooks: {
		beforeValidate: (uptime) => {
			if (uptime.dailyHours) {
				const hours = Object.values(uptime.dailyHours);
				if (hours.some(h => h < 0 || h > 24)) {
					throw new Error('Daily hours must be between 0 and 24.');
				}
			}
		},
	},
});

module.exports = Uptime;
