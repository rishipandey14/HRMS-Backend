const { seq } = require('../config/db');
const Permission = require('../models/RolesAndPermission/Permission');
const {
  RBAC_MODULES,
  RBAC_ACTIONS,
  buildPermissionLabel,
} = require('../constants/rbac');

const permissions = RBAC_MODULES.flatMap((moduleName) =>
	RBAC_ACTIONS.map((action) => ({
		key: `${moduleName}.${action}`,
		label: buildPermissionLabel(moduleName, action),
		description: `${action} permission for ${moduleName}`,
	}))
);

const seedRolesPermissions = async () => {
	try {
		await seq.authenticate();
		await seq.sync({ alter: false });

		for (const permission of permissions) {
			await Permission.upsert(permission);
		}

		console.log('Permission catalog seeded');
		process.exit(0);
	} catch (error) {
		console.error('Failed to seed permission catalog:', error.message);
		process.exit(1);
	}
};

seedRolesPermissions();
