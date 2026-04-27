const { seq } = require('../config/db');
const Permission = require('../models/RolesAndPermission/Permission');
const { RBAC_MODULES } = require('../constants/rbac');

async function cleanupOldPermissions() {
  try {
    console.log('📋 Starting permission cleanup...');
    console.log('Current valid modules:', RBAC_MODULES);

    // Extract module names from RBAC_MODULES
    const validModules = RBAC_MODULES;

    // Find and delete permissions for modules not in the current list
    const allPermissions = await Permission.findAll();
    
    const toDelete = allPermissions.filter(perm => {
      const moduleName = perm.key.split('.')[0]; // e.g., 'user' from 'user.view'
      return !validModules.includes(moduleName);
    });

    if (toDelete.length === 0) {
      console.log('✅ No old permissions to clean up.');
      return;
    }

    console.log(`🗑️  Found ${toDelete.length} old permissions to delete:`);
    toDelete.forEach(perm => console.log(`   - ${perm.key}`));

    // Delete them
    for (const perm of toDelete) {
      await perm.destroy();
    }

    console.log(`✅ Successfully deleted ${toDelete.length} old permissions`);
  } catch (error) {
    console.error('❌ Error cleaning up permissions:', error);
    throw error;
  }
}

// Run if executed directly
if (require.main === module) {
  seq.authenticate()
    .then(() => {
      console.log('✅ Database connected');
      return cleanupOldPermissions();
    })
    .then(() => {
      console.log('✅ Cleanup complete');
      process.exit(0);
    })
    .catch(err => {
      console.error('❌ Cleanup failed:', err);
      process.exit(1);
    });
}

module.exports = cleanupOldPermissions;
