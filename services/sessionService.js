const Session = require("../models/Session");
const Uptime = require("../models/Uptime");
const { getISOWeekString, getWeekDayName } = require("../utils/dateUtils");

/**
 * Creates a new login session for a user.
 * @param {Object} user - User object containing _id and companyCode.
 * @returns {Promise<Session>} The created session document.
 */
async function createSessionForUser(user) {
  const userId = user._id;
  const companyId = user.companyCode || user._id;

  const session = new Session({
    userId,
    companyId,
    loginAt: new Date(),
    logoutAt: null,
    durationHours: 0,
  });

  await session.save();
  return session;
}

/**
 * Ends the active session for a user and updates their uptime accordingly.
 * @param {Object} user - User object containing _id and companyCode.
 * @returns {Promise<{session: Session, uptime: Uptime}>} Updated session and uptime documents.
 * @throws Will throw an error if no active session found.
 */
async function endSessionForUser(user) {
  const userId = user._id;
  const companyId = user.companyCode || user._id;

  const session = await Session.findOne({ userId, logoutAt: null });
  if (!session) throw new Error("No active session found");

  session.logoutAt = new Date();
  session.durationHours =
    (session.logoutAt - session.loginAt) / (1000 * 60 * 60);

  await session.save();

  const week = getISOWeekString(session.logoutAt);
  const day = getWeekDayName(session.logoutAt);

  let uptime = await Uptime.findOne({ userId, companyId, week });
  if (!uptime) {
    uptime = new Uptime({ userId, companyId, week, dailyHours: {} });
  }

  const prevHours = uptime.dailyHours[day] || 0;
  let newHours = prevHours + session.durationHours;
  if (newHours > 24) newHours = 24;

  uptime.dailyHours[day] = newHours;

  await uptime.save();

  return { session, uptime };
}

module.exports = {
  createSessionForUser,
  endSessionForUser,
};
