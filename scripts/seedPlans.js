const { seq } = require('../config/db');
const Plans = require('../models/Plans');

const seedPlans = async () => {
	try {
		await seq.authenticate();
		await seq.sync({ alter: false });

		await Plans.upsert({
			id: 'basic',
			name: 'Basic',
			code: 'basic',
			status: 'active',
			billingInterval: 'monthly',
			priceCents: 0,
			currency: 'INR',
			sortOrder: 1,
			defaultLimits: {
				maxEmployees: 10,
			},
			featureFlags: {
				customRoles: false,
				customPermissions: false,
			},
			trialDays: 15,
		});

		await Plans.upsert({
			id: 'standard',
			name: 'Standard',
			code: 'standard',
			status: 'active',
			billingInterval: 'monthly',
			priceCents: 49900,
			currency: 'INR',
			sortOrder: 2,
			defaultLimits: {
				maxEmployees: 50,
			},
			featureFlags: {
				customRoles: true,
				customPermissions: true,
			},
			trialDays: 15,
		});

		await Plans.upsert({
			id: 'premium',
			name: 'Premium',
			code: 'premium',
			status: 'active',
			billingInterval: 'monthly',
			priceCents: 99900,
			currency: 'INR',
			sortOrder: 3,
			defaultLimits: {
				maxEmployees: 250,
			},
			featureFlags: {
				customRoles: true,
				customPermissions: true,
			},
			trialDays: 15,
		});

		console.log('Plans seeded');
		process.exit(0);
	} catch (error) {
		console.error('Failed to seed plans:', error.message);
		process.exit(1);
	}
};

seedPlans();
