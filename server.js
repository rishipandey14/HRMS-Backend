const app = require('./app');
const { connectDB } = require('./config/db');
require('dotenv').config();

const PORT = process.env.PORT || 7000;

// Connect to DB
connectDB().then(() => {
	app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}).catch((err) => {
	console.error('Database connection failed:', err);
	process.exit(1);
});