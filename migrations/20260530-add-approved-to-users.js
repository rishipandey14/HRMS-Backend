"use strict";

/**
 * Migration: add approved column to users and backfill based on user_roles
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const table = await queryInterface.describeTable('users');
    if (!table.approved) {
      await queryInterface.addColumn('users', 'approved', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
      console.log('Added approved column to users table');

      // Backfill: mark approved=true for users that already have role assignments
      // Works across most SQL dialects
      try {
        await queryInterface.sequelize.query(
          `UPDATE users SET approved = true WHERE EXISTS (SELECT 1 FROM user_roles WHERE user_roles.userId = users.id)`
        );
        console.log('Backfilled approved for users with role assignments');
      } catch (err) {
        console.warn('Backfill skipped or failed:', err.message);
      }
    }
  },

  down: async (queryInterface, Sequelize) => {
    const table = await queryInterface.describeTable('users');
    if (table.approved) {
      await queryInterface.removeColumn('users', 'approved');
      console.log('Removed approved column from users table');
    }
  },
};
