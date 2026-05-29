const { seq } = require('../config/db');
const Company = require('../models/Company/Company');
const Role = require('../models/RolesAndPermission/Role');
const { createSAdminRoleForCompany } = require('../services/rbacService');

const migrateSAdminRoles = async () => {
  try {
    console.log('📋 Starting sAdmin migration for existing companies...');

    await seq.authenticate();
    await seq.sync({ alter: false });

    // Get all companies
    const companies = await Company.findAll({
      attributes: ['id', 'companyName'],
    });

    if (companies.length === 0) {
      console.log('✅ No companies found to migrate');
      process.exit(0);
    }

    console.log(`Found ${companies.length} companies to check`);

    let createdCount = 0;
    let skippedCount = 0;

    for (const company of companies) {
      // Check if sAdmin role already exists
      const existingSAdmin = await Role.findOne({
        where: { companyId: company.id, name: 'sAdmin' }
      });

      if (existingSAdmin) {
        console.log(`⏭️  ${company.companyName} (${company.id}) - sAdmin already exists`);
        skippedCount++;
        continue;
      }

      try {
        await createSAdminRoleForCompany(company.id);
        console.log(`✅ Created sAdmin for ${company.companyName} (${company.id})`);
        createdCount++;
      } catch (error) {
        console.error(`❌ Failed to create sAdmin for ${company.companyName} (${company.id}):`, error.message);
      }
    }

    console.log('\n📊 Migration Summary:');
    console.log(`   ✅ Created: ${createdCount}`);
    console.log(`   ⏭️  Skipped: ${skippedCount}`);
    console.log(`   📦 Total companies: ${companies.length}`);
    console.log('\n✅ Migration complete!');

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
};

// Run if executed directly
if (require.main === module) {
  migrateSAdminRoles();
}

module.exports = migrateSAdminRoles;
