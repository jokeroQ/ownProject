const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
module.exports = sequelize.define('UserTodo', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  user_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
  title: { type: DataTypes.STRING(120), allowNull: false },
  notes: { type: DataTypes.STRING(2000), allowNull: false, defaultValue: '' },
  recurrence: { type: DataTypes.STRING(10), allowNull: false, defaultValue: 'none', validate: { isIn: [['none', 'daily', 'weekly']] } },
  due_date: { type: DataTypes.DATEONLY, allowNull: true },
  important: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  completed: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  completed_at: { type: DataTypes.DATE, allowNull: true },
  completed_period: { type: DataTypes.DATEONLY, allowNull: true },
}, { tableName: 'user_todos', timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at', indexes: [{ fields: ['user_id', 'completed'] }] });
