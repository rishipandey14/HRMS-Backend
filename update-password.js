const { seq } = require('./config/db');
const Company = require('./models/Company');
const bcrypt = require('bcryptjs');

(async () => {
  try {
    await seq.authenticate();
    const company = await Company.findOne({ where: { id: '171533' } });
    if (company) {
      company.password = await bcrypt.hash('Test@123', 10);
      await company.save();
      console.log('Password updated successfully');
    }
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
})();
