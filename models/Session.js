const { DataTypes } = require('sequelize');
const { seq } = require('../config/db');

const Session = seq.define('Session', {
	id: {
		type: DataTypes.INTEGER,
		primaryKey: true,
		autoIncrement: true,
	},
	userId: {
		type: DataTypes.INTEGER,
		allowNull: true,
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
	loginAt: {
		type: DataTypes.DATE,
		allowNull: false,
		defaultValue: DataTypes.NOW,
	},
	logoutAt: {
		type: DataTypes.DATE,
		allowNull: true,
		defaultValue: null,
	},
	durationHours: {
		type: DataTypes.FLOAT,
		defaultValue: 0,
	},
}, {
	timestamps: true,
	tableName: 'sessions',
	hooks: {
		beforeSave: (session) => {
			if (session.logoutAt && session.loginAt) {
				const diff = session.logoutAt.getTime() - session.loginAt.getTime();
				if (diff < 0) {
					throw new Error('logoutAt cannot be earlier than loginAt');
				}
				session.durationHours = diff / (1000 * 60 * 60);
			}
		},
	},
});

module.exports = Session;
