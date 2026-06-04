const parseEmployeeUnit = (unit) => {
	if (!unit) {
		return 0;
	}

	const match = String(unit).match(/\d+/);
	return match ? Number(match[0]) : 0;
};

const getEffectiveMaxEmployees = ({ plan, companyOverride, subscriptionAddons }) => {
	const planDefaults = plan && plan.defaultLimits ? plan.defaultLimits : {};
	const base = Number.isFinite(companyOverride && companyOverride.maxEmployees)
		? companyOverride.maxEmployees : planDefaults.maxEmployees || 0;

	const addons = Array.isArray(subscriptionAddons) ? subscriptionAddons : [];
	const extraSeats = addons.reduce((total, addon) => {
		const addonCode = addon.addonCode || addon.code;
		if (addonCode !== 'extra_employees') {
			return total;
		}

		const unitSize = parseEmployeeUnit(addon.unit);
		const qty = Number(addon.quantityPurchased || 0);
		return total + (unitSize * qty);
	}, 0);

	return base + extraSeats;
};

const getEffectiveFeatureFlags = ({ plan, companyOverride }) => {
	const planFlags = plan && plan.featureFlags ? plan.featureFlags : {};
	const overrideFlags = companyOverride && companyOverride.featureFlags ? companyOverride.featureFlags : {};

	return { ...planFlags, ...overrideFlags };
};

module.exports = {
	getEffectiveMaxEmployees,
	getEffectiveFeatureFlags,
};
