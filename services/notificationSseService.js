const clients = new Map();

// Build unique (company + role) keys
const buildKey = ({companyCode, role}) => `${companyCode}::${role || "all"}`;

const addClient = ({companyCode, role, res}) => {
  const key = buildKey({companyCode, role});  // created a key (companyCode::role)
  const group = clients.get(key) || new Set();
  group.add(res);  // added response to that role
  clients.set(key, group);
  return key;
};

const removeClient = ({key, res}) => {
  const group = clients.get(key);  // get the existing group to reomve
  if(!group) return;

  group.delete(res);   // removes the response
  if(group.size == 0) {   // if empty -> delete group
    clients.delete(key);
  }
};

const writeEvent = (res, event, data) => {
  res.write(`Event : ${event}\n`);
  res.write(`Data : ${data}\n\n`);
};


const publishNotificationToRoles = ({
  companyCode,
  event = "notification.created",
  notification,
  roles = ["all"],
}) => {
  const targetRoles = roles.length ? roles : ["all"];

  targetRoles.forEach((role) => {
    const key = buildKey({ companyCode, role });
    const group = clients.get(key);
    if (!group || group.size === 0) {
      return;
    }

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
  writeEvent,
};
