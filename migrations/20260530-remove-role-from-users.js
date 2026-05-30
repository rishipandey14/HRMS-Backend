"use strict";

/**
 * Migration: remove role column from users table
 * Role is now managed through UserRole model relationship
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const table = await queryInterface.describeTable('users');
    if (table.role) {
      await queryInterface.removeColumn('users', 'role');
      console.log('Removed role column from users table');
    }
  },

  down: async (queryInterface, Sequelize) => {
    const table = await queryInterface.describeTable('users');
    if (!table.role) {
      await queryInterface.addColumn('users', 'role', {
        type: Sequelize.STRING,
        defaultValue: 'unauthorized',
      });
      console.log('Re-added role column to users table');
    }
  },
};
