const http = require('http');
const app = require('./app');
const { connectDB } = require('./config/db');
const { setupSocket } = require('./sockets/socket');
require('dotenv').config();

const PORT = process.env.PORT || 7000;

// Create HTTP server
const server = http.createServer(app);

// Setup socket.io
setupSocket(server);

// Connect to DB and start server
connectDB().then(() => {
	server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}).catch((err) => {
	console.error('Database connection failed:', err);
	process.exit(1);
});