'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		await queryInterface.createTable('holidays', {
			id: {
				type: Sequelize.INTEGER,
				primaryKey: true,
				autoIncrement: true,
				allowNull: false,
			},
			companyId: {
				type: Sequelize.STRING(6),
				allowNull: false,
				references: {
					model: 'companies',
					key: 'id',
				},
				onDelete: 'CASCADE',
				onUpdate: 'CASCADE',
			},
			name: {
				type: Sequelize.STRING,
				allowNull: false,
			},
			dateLabel: {
				type: Sequelize.STRING,
				allowNull: false,
			},
			startDate: {
				type: Sequelize.DATEONLY,
				allowNull: true,
			},
			endDate: {
				type: Sequelize.DATEONLY,
				allowNull: true,
			},
			createdBy: {
				type: Sequelize.INTEGER,
				allowNull: true,
				references: {
					model: 'users',
					key: 'id',
				},
				onDelete: 'SET NULL',
				onUpdate: 'CASCADE',
			},
			updatedBy: {
				type: Sequelize.INTEGER,
				allowNull: true,
				references: {
					model: 'users',
					key: 'id',
				},
				onDelete: 'SET NULL',
				onUpdate: 'CASCADE',
			},
			createdAt: {
				type: Sequelize.DATE,
				allowNull: false,
				defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
			},
			updatedAt: {
				type: Sequelize.DATE,
				allowNull: false,
				defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
			},
		});

		await queryInterface.addIndex('holidays', ['companyId']);
		await queryInterface.addIndex('holidays', ['companyId', 'dateLabel']);
	},

	async down(queryInterface) {
		await queryInterface.dropTable('holidays');
	},
};