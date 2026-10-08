const { Sequelize } = require('sequelize');
// Production credentials are supplied through the environment, never committed.
const sequelize = new Sequelize(
  process.env.DB_NAME || 'noIdea',
  process.env.DB_USER || 'root',
  process.env.DB_PASSWORD || '',
  {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    dialect: 'mysql',
    dialectOptions: process.env.DB_SOCKET ? { socketPath: process.env.DB_SOCKET } : {},
    logging: false,
  }
);
module.exports = sequelize;
