const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
module.exports = sequelize.define('UserPreference', {
  user_id: { type: DataTypes.INTEGER, primaryKey: true, references: { model: 'users', key: 'id' } },
  tool: { type: DataTypes.STRING(32), primaryKey: true },
  content: { type: DataTypes.JSON, allowNull: false },
}, { tableName: 'user_preferences', timestamps: false });
