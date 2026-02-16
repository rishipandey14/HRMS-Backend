const { seq } = require('../config/db');
const Company = require('../models/Company');
const Plans = require('../models/Plans');
const CompanySubscription = require('../models/CompanySubscription');

const migrateCompaniesToBasic = async () => {
	try {
		await seq.authenticate();
		await seq.sync({ alter: false });

		const basicPlan = await Plans.findByPk('basic');
		if (!basicPlan) {
			throw new Error('Basic plan not found. Run seedPlans first.');
		}

		const companies = await Company.findAll({ attributes: ['id'] });

		for (const company of companies) {
			const companyId = company.id;
			const existing = await CompanySubscription.findOne({ where: { companyId, status: 'active' } });
			if (existing) {
				continue;
			}

			await CompanySubscription.create({
				companyId,
				planId: basicPlan.id,
				status: 'active',
				autoRenew: true,
			});
		}

		console.log('Companies migrated to Basic plan');
		process.exit(0);
	} catch (error) {
		console.error('Failed to migrate companies:', error.message);
		process.exit(1);
	}
};

migrateCompaniesToBasic();
