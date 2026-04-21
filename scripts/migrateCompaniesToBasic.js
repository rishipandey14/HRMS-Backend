const { seq } = require('../config/db');
const Company = require('../models/Company/Company');
const Plans = require('../models/Plans/Plans');
const CompanySubscription = require('../models/Plans/CompanySubscription');

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

			const startsAt = company.createdAt || new Date();
			const endsAt = new Date(startsAt);
			endsAt.setDate(endsAt.getDate() + 7);

			await CompanySubscription.create({
				companyId,
				planId: basicPlan.id,
				status: 'active',
				startsAt,
				endsAt,
				autoRenew: false,
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
