const express = require("express");
const dotenv = require("dotenv");

dotenv.config();

let Redis = null;
try {
  Redis = require("ioredis");
} catch (err) {
  console.warn("Redis client disabled: ioredis is not available.", err.message);
}

const cors = require('cors');
const app = express();

app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

if (Redis) {
  const redis = new Redis({
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
    username: process.env.REDIS_USERNAME,
    password: process.env.REDIS_PASSWORD
  });

  redis.on("connect", () => {
    console.log("redis connected");
  });

  redis.on("error", (err) => {
    console.error("Redis connection error: ", err.message);
  });
}

try {
  app.use("/api/auth", require("./routes/authRoutes"));
  app.use("/api/user", require("./routes/userRoutes"));
  app.use("/api/company", require("./routes/companyRoutes"));
  app.use("/api/projects", require("./routes/projectRoutes"));
  app.use("/api/uptimes", require("./routes/uptimeRoutes"));
  app.use("/api/notifications", require("./routes/notificationRoutes"));
  app.use("/api/dashboard", require("./routes/dashboardRoutes"));
  app.use("/api/chats", require("./routes/chatRoutes"));
  app.use("/api/messages", require("./routes/messageRoutes"));
  app.use('/api/rbac', require('./routes/rbacRoutes'));
  app.use('/api/holidays', require('./routes/holidayRoutes'));
  app.use('/api/integrations', require('./routes/integrationsRoutes'));
  app.use('/api/candidates', require('./routes/candidatesRoutes'));
  app.use('/api/jobs', require('./routes/jobsRoutes'));
} catch (err) {
  console.error('Error loading routes:', err.message);
  process.exit(1);
}

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong!" });
});

app.get("/", (req, res) => res.send("Backend is running"));

// Serve public uploads
const path = require('path');
app.use('/uploads', require('express').static(path.resolve(__dirname, 'public_uploads')));

// Public routes for job pages and apply
try {
  const { router: publicRouter } = require('./routes/publicRoutes');
  app.use('/api/public', publicRouter);
} catch (e) {
  console.warn('Public routes not mounted:', e.message);
}

module.exports = app;
