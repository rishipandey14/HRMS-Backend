const express = require("express");
const dotenv = require("dotenv");

dotenv.config();

const cors = require('cors');
const app = express();

app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

try {
  app.use("/api/auth", require("./routes/authRoutes"));
  app.use("/api/user", require("./routes/userRoutes"));
  app.use("/api/company", require("./routes/companyRoutes"));
  app.use("/api/projects", require("./routes/projectRoutes"));
  app.use("/api/tasks/:projectId", require("./routes/taskRoutes"));
  app.use("/api/uptimes", require("./routes/uptimeRoutes"));
  app.use("/api/notifications", require("./routes/notificationRoutes"));
  app.use("/api/dashboard", require("./routes/dashboardRoutes"));
} catch (err) {
  console.error('Error loading routes:', err.message);
  process.exit(1);
}

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong!" });
});

app.get("/", (req, res) => res.send("Backend is running"));

module.exports = app;
