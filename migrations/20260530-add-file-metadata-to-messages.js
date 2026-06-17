'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		await queryInterface.addColumn('Messages', 'fileSize', {
			type: Sequelize.INTEGER,
			allowNull: true,
		});

		await queryInterface.addColumn('Messages', 'fileMimeType', {
			type: Sequelize.STRING,
			allowNull: true,
		});
	},

	async down(queryInterface) {
		await queryInterface.removeColumn('Messages', 'fileMimeType');
		await queryInterface.removeColumn('Messages', 'fileSize');
	},
};