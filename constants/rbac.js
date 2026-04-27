const RBAC_MODULES = [
  'organization',
  'user',
  'role',
  'permission',
  'dashboard',
  'project',
  'task',
  'update',
  'chat',
  'message',
  'notification',
  'settings',
  'subscription',
];

const RBAC_ACTIONS = ['view', 'create', 'update', 'delete'];

const buildPermissionKey = (moduleName, action) => `${moduleName}.${action}`;

const buildPermissionLabel = (moduleName, action) => {
  const moduleLabel = moduleName
    .split('_')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');

  const actionLabel = action.charAt(0).toUpperCase() + action.slice(1);
  return `${actionLabel} ${moduleLabel}`;
};

const ALL_DEFAULT_PERMISSION_KEYS = RBAC_MODULES.flatMap((moduleName) =>
  RBAC_ACTIONS.map((action) => buildPermissionKey(moduleName, action))
);

module.exports = {
  RBAC_MODULES,
  RBAC_ACTIONS,
  ALL_DEFAULT_PERMISSION_KEYS,
  buildPermissionKey,
  buildPermissionLabel,
};
