const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
module.exports = sequelize.define('Session', {
  token_hash: { type: DataTypes.STRING(64), primaryKey: true },
  user_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'users', key: 'id' } },
  expires_at: { type: DataTypes.DATE, allowNull: false },
}, { tableName: 'user_sessions', timestamps: false });
