/*
  Script: checkApprovedBackfill.js
  Purpose: List users who would be backfilled (have a user_roles entry but approved is false/null)
  Run from project root (task-tracker-backend):
    node scripts/checkApprovedBackfill.js
*/

const { seq } = require('../config/db');

(async () => {
  try {
    if (seq && typeof seq.authenticate === 'function') {
      await seq.authenticate();
    }

    const sql = `
      SELECT users.id, users.email
      FROM users
      INNER JOIN user_roles ON user_roles.userId = users.id
      WHERE COALESCE(users.approved, FALSE) = FALSE
      GROUP BY users.id, users.email
      ORDER BY users.id ASC
    `;

    const [results] = await seq.query(sql, { raw: true });

    console.log(`Found ${results.length} user(s) that would be backfilled:`);
    results.forEach((u) => console.log(`${u.id}\t${u.email}`));

    if (results.length === 0) {
      console.log('No users need backfilling.');
    }

    process.exit(0);
  } catch (err) {
    console.error('Error checking backfill candidates:', err);
    process.exit(1);
  }
})();
