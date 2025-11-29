const {
  createSessionForUser,
  endSessionForUser,
} = require("../services/sessionService");

const createSession = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const session = await createSessionForUser(req.user);
    res
      .status(201)
      .json({ message: "Session started", sessionId: session._id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error creating session" });
  }
};

const endSession = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const { session, uptime } = await endSessionForUser(req.user);
    res.json({ message: "Session ended", session, uptime });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message });
  }
};

module.exports = {
  createSession,
  endSession,
};
