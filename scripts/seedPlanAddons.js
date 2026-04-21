const { seq } = require('../config/db');
const PlanAddon = require('../models/Plans/PlanAddon');

const seedPlanAddons = async () => {
	try {
		await seq.authenticate();
		await seq.sync({ alter: false });

		await PlanAddon.upsert({
			code: 'extra_employees',
			name: 'Extra Employees',
			unitPriceCents: 5000,
			currency: 'INR',
			unit: 'per_10_employees',
			status: 'active',
			description: 'Adds 10 additional employee seats',
		});

		console.log('Plan add-ons seeded');
		process.exit(0);
	} catch (error) {
		console.error('Failed to seed plan add-ons:', error.message);
		process.exit(1);
	}
};

seedPlanAddons();
