const User = require('../models/User/User');

const collectHierarchyUserIds = async ({ companyCode, userIds = [], maxDepth = 5 }) => {
  const uniqueIds = new Set();
  const queue = [...new Set(userIds.filter(Boolean).map((id) => Number(id)))];
  let depth = 0;

  while (queue.length > 0 && depth < maxDepth) {
    const batch = queue.splice(0, queue.length);
    const users = await User.findAll({
      where: { id: batch, companyCode },
      attributes: ['id', 'managerId'],
    });

    for (const user of users) {
      if (user?.id) uniqueIds.add(Number(user.id));
      if (user?.managerId && !uniqueIds.has(Number(user.managerId))) {
        queue.push(Number(user.managerId));
      }
    }

    depth += 1;
  }

  return Array.from(uniqueIds);
};

module.exports = { collectHierarchyUserIds };