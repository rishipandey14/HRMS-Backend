const axios = require("axios");
const jwt = require('jsonwebtoken');
const messageEvents = require("./events/message");
const typingEvents = require("./events/typing");
const seenEvents = require("./events/seen");
const userEvents = require("./events/user");
const Chat = require("../models/Chat/Chat");
const { markUserOnline, markUserOffline, markUserHeartbeat } = require("../services/presenceService");
const Session = require('../models/Others/Session');
const { createSessionForUser } = require('../services/sessionService');

// Use localhost for local dev, task-tracker-backend for Docker
const TASK_TRACKER_URL = process.env.TASK_TRACKER_URL || 
  (process.env.NODE_ENV === "production" 
    ? "http://task-tracker-backend:7000" 
    : "http://localhost:7000");

const registerSocketHandlers = (io) => {
  io.on("connection", async (socket) => {
    console.log("New socket connected:", socket.id);

    socket.once("connect_user", async () => {
      try {
        const token = socket.handshake.auth?.token;
        if (!token) {
          console.log("No auth token provided");
          return socket.disconnect();
        }

        // Try verifying token locally to avoid an HTTP roundtrip
        let payload = null;
        try {
          payload = jwt.verify(token, process.env.JWT_SECRET);
        } catch (jwtErr) {
          // local verification failed - fall back to task-tracker verify endpoint
          try {
            const response = await axios.get(`${TASK_TRACKER_URL}/api/auth/verify-token`, {
              headers: { Authorization: `Bearer ${token}` },
              timeout: 5000,
            });
            payload = response.data?.user || null;
          } catch (httpErr) {
            console.error('Token verification failed (http):', httpErr.message);
            return socket.disconnect();
          }
        }

        if (!payload || !payload.id) {
          console.log('Token did not contain user id');
          return socket.disconnect();
        }

        socket.userId = payload.id;
        socket.companyCode = payload.companyCode || payload.id;
        socket.join(`user_${socket.userId}`);
        if (socket.companyCode) {
          socket.join(`company_${socket.companyCode}`);
        }

        const onlinePresence = markUserOnline(socket.userId);
        // Ensure a DB session exists for this socket connection - non-blocking
        (async () => {
          try {
            const existing = await Session.findOne({ where: { userId: socket.userId, logoutAt: null } });
            if (!existing) {
              // payload has user info; use createSessionForUser which will insert loginAt
              await createSessionForUser({ id: socket.userId, companyCode: socket.companyCode });
            }
          } catch (err) {
            console.error('Error ensuring session record for user', socket.userId, err && err.message ? err.message : err);
          }
        })();
        if (socket.companyCode) {
          io.to(`company_${socket.companyCode}`).emit("presence_changed", {
            userId: socket.userId,
            companyCode: socket.companyCode,
            ...onlinePresence,
          });
        }
        console.log(`User ${socket.userId} connected. Socket rooms:`, Array.from(socket.rooms));

        // Register event handlers
        messageEvents(io, socket);
        typingEvents(io, socket);
        seenEvents(io, socket);
        userEvents(io, socket);

        socket.on("disconnect", async () => {
          console.log(`User ${socket.userId} disconnected. Socket: ${socket.id}`);
          try {
            const offlinePresence = await markUserOffline(socket.userId);
            if (socket.companyCode) {
              io.to(`company_${socket.companyCode}`).emit("presence_changed", {
                userId: socket.userId,
                companyCode: socket.companyCode,
                ...offlinePresence,
              });
            }
          } catch (err) {
            console.error('Error on disconnect presence update for', socket.userId, err && err.message ? err.message : err);
          }
        });

        // Heartbeat pings from client to persist lastSeenAt while connected
        socket.on('presence_ping', async (payload) => {
          try {
            const presence = await markUserHeartbeat(socket.userId, payload?.ts ? new Date(payload.ts) : new Date());
            if (socket.companyCode) {
              io.to(`company_${socket.companyCode}`).emit('presence_changed', {
                userId: socket.userId,
                companyCode: socket.companyCode,
                ...presence,
              });
            }
          } catch (err) {
            console.error('Error handling presence_ping for', socket.userId, err && err.message ? err.message : err);
          }
        });
      } catch (err) {
        console.error("connect_user error:", err && err.stack ? err.stack : err.message || err);
        socket.disconnect();
      }
    });
  });
};

module.exports = registerSocketHandlers;
