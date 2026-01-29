const Session = require("../models/Session");
const Uptime = require("../models/Uptime");
const { getISOWeekString, getWeekDayName } = require("../utils/dateUtils");

// Creates a new login session for a user or company.
async function createSessionForUser(user, isCompany = false) {
  try {
    const userId = isCompany ? null : user.id; // Companies don't have userId
    const companyId = isCompany ? user.id : user.companyCode;

    if (!companyId) {
      throw new Error('companyId is required for session creation');
    }

    const session = await Session.create({
      userId,
      companyId,
      loginAt: new Date(),
      logoutAt: null,
      durationHours: 0,
    });

    return session;
  } catch (error) {
    console.error('Session creation error:', error.message);
    throw error;
  }
}

// Ends the active session for a user or company and updates their uptime accordingly.
async function endSessionForUser(user, isCompany = false) {
  try {
    const userId = isCompany ? null : user.id;
    const companyId = isCompany ? user.id : user.companyCode;

    // Find active session - for companies, userId will be null, so only match by companyId
    const whereClause = isCompany 
      ? { companyId, userId: null, logoutAt: null }
      : { userId, logoutAt: null };
      
    const session = await Session.findOne({ where: whereClause });
    if (!session) throw new Error("No active session found");

    session.logoutAt = new Date();
    session.durationHours =
      (session.logoutAt - session.loginAt) / (1000 * 60 * 60);

    await session.save();

    // Only create uptime for users, not companies
    if (!isCompany && userId) {
      const week = getISOWeekString(session.logoutAt);
      const day = getWeekDayName(session.logoutAt);

      let uptime = await Uptime.findOne({ where: { userId, companyId, week } });
      if (!uptime) {
        uptime = await Uptime.create({ userId, companyId, week, dailyHours: {} });
      }

      const prevHours = uptime.dailyHours?.[day] || 0;
      let newHours = prevHours + session.durationHours;
      if (newHours > 24) newHours = 24;

      uptime.dailyHours = { ...(uptime.dailyHours || {}), [day]: newHours };

      await uptime.save();

      return { session, uptime };
    }

    return { session, uptime: null };
  } catch (error) {
    console.error('Session end error:', error.message);
    throw error;
  }
}

module.exports = {
  createSessionForUser,
  endSessionForUser,
};
