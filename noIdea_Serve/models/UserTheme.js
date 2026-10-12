const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
module.exports = sequelize.define('UserTheme', {
  user_id: { type: DataTypes.INTEGER, primaryKey: true, references: { model: 'users', key: 'id' } },
  mode: { type: DataTypes.STRING(10), allowNull: false, defaultValue: 'light' },
  primary_color: { type: DataTypes.STRING(7), allowNull: false, defaultValue: '#409eff' },
  overlay: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0.35 },
  background_file: { type: DataTypes.STRING(80), allowNull: true },
}, { tableName: 'user_themes', timestamps: false });
