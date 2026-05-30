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
const { init: initPresence } = require('./services/presenceService');
const { shutdown: shutdownPresence } = require('./services/presenceService');

connectDB().then(async () => {
	// Load persisted presence timestamps into memory
	await initPresence();
	server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}).catch((err) => {
	console.error('Database connection failed:', err);
	process.exit(1);
});

const graceful = async () => {
	console.log('Graceful shutdown initiated');
	try {
		await shutdownPresence();
	} catch (err) {
		console.error('Error during presence shutdown:', err && err.message ? err.message : err);
	}
	process.exit(0);
};

process.on('SIGINT', graceful);
process.on('SIGTERM', graceful);