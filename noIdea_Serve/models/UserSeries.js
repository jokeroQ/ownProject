const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
module.exports = sequelize.define('UserSeries', {
  user_id: { type: DataTypes.INTEGER, primaryKey: true, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
  series_id: { type: DataTypes.STRING(100), primaryKey: true },
  item: { type: DataTypes.JSON, allowNull: false },
  favorite: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  watch_status: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'none' },
}, { tableName: 'user_series', timestamps: true, createdAt: 'saved_at', updatedAt: 'updated_at' });
