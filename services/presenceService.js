const onlineCounts = new Map();
const lastSeenAt = new Map();

const normalizeUserId = (userId) => {
  if (userId === null || userId === undefined) return null;
  return String(userId);
};

const toISO = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const getPresence = (userId) => {
  const normalizedUserId = normalizeUserId(userId);
  if (!normalizedUserId) {
    return {
      isOnline: false,
      onlineCount: 0,
      lastSeenAt: null,
    };
  }

  const onlineCount = onlineCounts.get(normalizedUserId) || 0;
  const storedLastSeenAt = lastSeenAt.get(normalizedUserId) || null;

  return {
    isOnline: onlineCount > 0,
    onlineCount,
    lastSeenAt: toISO(storedLastSeenAt),
  };
};

const markUserOnline = (userId) => {
  const normalizedUserId = normalizeUserId(userId);
  if (!normalizedUserId) return getPresence(userId);

  const currentCount = onlineCounts.get(normalizedUserId) || 0;
  onlineCounts.set(normalizedUserId, currentCount + 1);

  return getPresence(normalizedUserId);
};

const markUserOffline = (userId) => {
  const normalizedUserId = normalizeUserId(userId);
  if (!normalizedUserId) return getPresence(userId);

  const currentCount = onlineCounts.get(normalizedUserId) || 0;
  if (currentCount <= 1) {
    onlineCounts.delete(normalizedUserId);
    lastSeenAt.set(normalizedUserId, new Date());
  } else {
    onlineCounts.set(normalizedUserId, currentCount - 1);
  }

  return getPresence(normalizedUserId);
};

module.exports = {
  getPresence,
  markUserOnline,
  markUserOffline,
};