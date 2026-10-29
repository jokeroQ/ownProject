const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
module.exports = sequelize.define('UserReport', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  user_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
  type: { type: DataTypes.STRING(10), allowNull: false, validate: { isIn: [['daily', 'weekly']] } },
  period_start: { type: DataTypes.DATEONLY, allowNull: false },
  period_end: { type: DataTypes.DATEONLY, allowNull: false },
  accomplishments: { type: DataTypes.TEXT, allowNull: false },
  plans: { type: DataTypes.TEXT, allowNull: false, defaultValue: '' },
  blockers: { type: DataTypes.TEXT, allowNull: false, defaultValue: '' },
}, {
  tableName: 'user_reports', timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at',
  indexes: [{ unique: true, fields: ['user_id', 'type', 'period_start'] }],
});
