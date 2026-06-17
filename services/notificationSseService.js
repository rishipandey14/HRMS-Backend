const clients = new Map();

// Build unique (company + role) keys
const buildKey = ({companyCode, role}) => `${companyCode}::${role || "all"}`;

const addClient = ({companyCode, role, userId, res}) => {
  // Registers a response for role and/or specific user
  const keys = [];

  if (userId) {
    const userKey = `${companyCode}::user:${userId}`;
    const userGroup = clients.get(userKey) || new Set();
    userGroup.add(res);
    clients.set(userKey, userGroup);
    keys.push(userKey);
  }

  if (role) {
    const roleKey = buildKey({ companyCode, role });
    const roleGroup = clients.get(roleKey) || new Set();
    roleGroup.add(res);
    clients.set(roleKey, roleGroup);
    keys.push(roleKey);
  }

  // fallback to generic group when neither provided
  if (!userId && !role) {
    const key = buildKey({ companyCode, role });
    const group = clients.get(key) || new Set();
    group.add(res);
    clients.set(key, group);
    keys.push(key);
  }

  return keys;
};

const removeClient = ({key, res}) => {
  const keys = Array.isArray(key) ? key : [key];
  keys.forEach((k) => {
    const group = clients.get(k);
    if (!group) return;
    group.delete(res);
    if (group.size == 0) clients.delete(k);
  });
};

const writeEvent = (res, event, data) => {
  // Proper SSE format: lowercase 'event' and 'data' lines, JSON stringify data
  try {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  } catch (err) {
    // fallback to safe string
    res.write(`event: ${event}\n`);
    res.write(`data: ${String(data)}\n\n`);
  }
};


const publishNotificationToRoles = ({
  companyCode,
  event = "notification.created",
  notification,
  roles = [],
}) => {
  // Do not broadcast to everyone by default. Require explicit roles array.
  if (!Array.isArray(roles) || roles.length === 0) return;

  roles.forEach((role) => {
    const key = buildKey({ companyCode, role });
    const group = clients.get(key);
    if (!group || group.size === 0) return;

    group.forEach((res) => {
      writeEvent(res, event, { notification });
    });
  });
};

const publishNotificationToUsers = ({
  companyCode,
  event = "notification.created",
  notification,
  userIds = [],
}) => {
  if (!Array.isArray(userIds) || userIds.length === 0) return;

  userIds.forEach((id) => {
    const key = `${companyCode}::user:${id}`;
    const group = clients.get(key);
    if (!group || group.size === 0) return;

    group.forEach((res) => {
      writeEvent(res, event, { notification });
    });
  });
};

const publishNotificationToAdmin = ({
  companyCode,
  event = "notification.created",
  notification,
}) => {
  publishNotificationToRoles({
    companyCode,
    event,
    notification,
    roles: ["admin"],
  });
};

module.exports = {
  addClient,
  removeClient,
  publishNotificationToAdmin,
  publishNotificationToRoles,
  publishNotificationToUsers,
  writeEvent,
};
