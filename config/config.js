require('dotenv').config();

const base = {
  dialect: 'mysql',
  logging: process.env.SQL_LOGGING === 'true' ? console.log : false,
};

const fromUrl = process.env.DB_URL || process.env.DB_URI;

const fromEnv = {
  username: process.env.DB_USER || process.env.MYSQL_USER || 'root',
  password: process.env.DB_PASSWORD || process.env.MYSQL_PASSWORD || '',
  database: process.env.DB_NAME || process.env.MYSQL_DATABASE || 'hrms',
  host: process.env.DB_HOST || process.env.MYSQL_HOST || 'mysql',
  port: Number(process.env.DB_PORT || process.env.MYSQL_PORT || 3306),
};

const buildConfig = () => {
  if (fromUrl) {
    return {
      development: {
        ...base,
        url: fromUrl,
      },
      test: {
        ...base,
        url: process.env.TEST_DB_URL || fromUrl,
      },
      production: {
        ...base,
        url: process.env.DATABASE_URL || fromUrl,
      },
    };
  }

  return {
    development: { ...base, ...fromEnv },
    test: {
      ...base,
      ...fromEnv,
      database: process.env.TEST_DB_NAME || `${fromEnv.database}_test`,
    },
    production: { ...base, ...fromEnv },
  };
};

module.exports = buildConfig();
