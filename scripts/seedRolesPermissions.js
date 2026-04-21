const { seq } = require('../config/db');
const Company = require('../models/Company/Company');
const Role = require('../models/RolesAndPermission/Role');
const Permission = require('../models/RolesAndPermission/Permission');
const RolePermission = require('../models/RolesAndPermission/RolePermission');

const permissions = [
	{ key: 'user.read', label: 'Read users' },
	{ key: 'user.manage', label: 'Manage users' },
	{ key: 'project.read', label: 'Read projects' },
	{ key: 'project.manage', label: 'Manage projects' },
	{ key: 'task.read', label: 'Read tasks' },
	{ key: 'task.manage', label: 'Manage tasks' },
	{ key: 'settings.read', label: 'Read settings' },
	{ key: 'settings.manage', label: 'Manage settings' },
];

const rolePermissionMap = {
	employee: ['project.read', 'task.read'],
	manager: ['project.read', 'project.manage', 'task.read', 'task.manage'],
	admin: ['user.read', 'user.manage', 'project.read', 'project.manage', 'task.read', 'task.manage', 'settings.read', 'settings.manage'],
	sadmin: ['user.read', 'user.manage', 'project.read', 'project.manage', 'task.read', 'task.manage', 'settings.read', 'settings.manage'],
};

const seedRolesPermissions = async () => {
	try {
		await seq.authenticate();
		await seq.sync({ alter: false });

		for (const permission of permissions) {
			await Permission.upsert(permission);
		}

		const companies = await Company.findAll({ attributes: ['id'] });

		for (const company of companies) {
			const companyId = company.id;
			const roleNames = ['employee', 'manager', 'admin', 'sadmin'];

			for (const roleName of roleNames) {
				const [role] = await Role.findOrCreate({
					where: { companyId, name: roleName },
					defaults: { isSystem: true, isCustom: false },
				});

				const permKeys = rolePermissionMap[roleName] || [];
				if (permKeys.length === 0) {
					continue;
				}

				const perms = await Permission.findAll({ where: { key: permKeys } });
				for (const perm of perms) {
					const existing = await RolePermission.findOne({
						where: { roleId: role.id, permissionId: perm.id },
					});
					if (!existing) {
						await RolePermission.create({ roleId: role.id, permissionId: perm.id });
					}
				}
			}
		}

		console.log('System roles and permissions seeded');
		process.exit(0);
	} catch (error) {
		console.error('Failed to seed roles/permissions:', error.message);
		process.exit(1);
	}
};

seedRolesPermissions();
