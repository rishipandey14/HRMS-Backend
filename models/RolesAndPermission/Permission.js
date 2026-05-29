const { DataTypes } = require('sequelize');
const { seq } = require('../../config/db');

const Permission = seq.define('Permission', {
	id: {
		type: DataTypes.INTEGER,
		primaryKey: true,
		autoIncrement: true,
	},
	key: {
		type: DataTypes.STRING,
		allowNull: false,
	},
	label: {
		type: DataTypes.STRING,
		allowNull: false,
	},
	description: {
		type: DataTypes.TEXT,
		allowNull: true,
	},
}, {
	timestamps: true,
	tableName: 'permissions',
		indexes: [
			{
				unique: true,
				fields: ['key'],
				name: 'permissions_key_unique'
			}
		],
});

module.exports = Permission;
