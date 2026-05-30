const onlineCounts = new Map();
const lastSeenAt = new Map();

// Persist presence to DB
const User = require('../models/User/User');
const Session = require('../models/Others/Session');

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

const markUserOffline = async (userId) => {
  const normalizedUserId = normalizeUserId(userId);
  if (!normalizedUserId) return getPresence(userId);

  const currentCount = onlineCounts.get(normalizedUserId) || 0;
  if (currentCount <= 1) {
    onlineCounts.delete(normalizedUserId);
    const now = new Date();
    lastSeenAt.set(normalizedUserId, now);
    // persist to DB (awaited for stronger guarantees)
    try {
      await User.update({ lastSeenAt: now }, { where: { id: normalizedUserId } });
    } catch (err) {
      console.error('Failed to persist lastSeenAt for user', normalizedUserId, err && err.message ? err.message : err);
    }

    // Also update the user's latest open Session (logoutAt) for auditing
    try {
      const openSession = await Session.findOne({ where: { userId: normalizedUserId, logoutAt: null }, order: [['loginAt', 'DESC']] });
      if (openSession) {
        openSession.logoutAt = now;
        await openSession.save();
      }
    } catch (err) {
      console.error('Failed to update Session.logoutAt for user', normalizedUserId, err && err.message ? err.message : err);
    }
  } else {
    onlineCounts.set(normalizedUserId, currentCount - 1);
  }

  return getPresence(normalizedUserId);
};

// Heartbeat/keepalive: update lastSeenAt while user remains connected
const markUserHeartbeat = async (userId, timestamp = new Date()) => {
  const normalizedUserId = normalizeUserId(userId);
  if (!normalizedUserId) return null;
  lastSeenAt.set(normalizedUserId, timestamp);
  try {
    await User.update({ lastSeenAt: timestamp }, { where: { id: normalizedUserId } });
  } catch (err) {
    console.error('Failed to persist heartbeat lastSeenAt for user', normalizedUserId, err && err.message ? err.message : err);
  }
  return getPresence(normalizedUserId);
};

// Load persisted lastSeenAt values from DB into memory at startup
const init = async () => {
  try {
    const users = await User.findAll({ attributes: ['id', 'lastSeenAt'] });
    users.forEach((u) => {
      if (u && u.id && u.lastSeenAt) {
        lastSeenAt.set(String(u.id), u.lastSeenAt);
      }
    });
    console.log('presenceService initialized - loaded lastSeenAt from DB for', lastSeenAt.size, 'users');
    // Backfill missing lastSeenAt from sessions table where possible
    try {
      const sessions = await Session.findAll({ where: {}, attributes: ['userId', 'loginAt', 'logoutAt'], order: [['loginAt', 'DESC']] });
      sessions.forEach((s) => {
        const uid = String(s.userId);
        if (!lastSeenAt.get(uid)) {
          const ts = s.logoutAt || s.loginAt || null;
          if (ts) lastSeenAt.set(uid, ts);
        }
      });
      console.log('presenceService backfilled lastSeenAt from sessions for', lastSeenAt.size, 'users');
    } catch (err) {
      console.error('presenceService backfill error:', err && err.message ? err.message : err);
    }
  } catch (err) {
    console.error('presenceService.init error:', err && err.message ? err.message : err);
  }
};

// Graceful shutdown: persist lastSeenAt for all currently tracked users
const shutdown = async () => {
  try {
    const entries = Array.from(onlineCounts.keys());
    const now = new Date();
    for (const userId of entries) {
      try {
        lastSeenAt.set(userId, now);
        await User.update({ lastSeenAt: now }, { where: { id: userId } });
      } catch (err) {
        console.error('presenceService.shutdown error for', userId, err && err.message ? err.message : err);
      }
    }
    console.log('presenceService.shutdown completed for', entries.length, 'users');
  } catch (err) {
    console.error('presenceService.shutdown error:', err && err.message ? err.message : err);
  }
};

module.exports = {
  getPresence,
  markUserOnline,
  markUserOffline,
  markUserHeartbeat,
  init,
  shutdown,
};