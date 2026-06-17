"use strict";

/**
 * Migration: add lastSeenAt column to users table
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const table = await queryInterface.describeTable('users');
    if (!table.lastSeenAt) {
      await queryInterface.addColumn('users', 'lastSeenAt', {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: null,
      });
    }
  },

  down: async (queryInterface) => {
    const table = await queryInterface.describeTable('users');
    if (table.lastSeenAt) {
      await queryInterface.removeColumn('users', 'lastSeenAt');
    }
  },
};
