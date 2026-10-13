const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
module.exports = sequelize.define('UserFlowchart', {
  user_id: { type: DataTypes.INTEGER, primaryKey: true, references: { model: 'users', key: 'id' } },
  document: { type: DataTypes.JSON, allowNull: false,
    get() { const value = this.getDataValue('document'); return typeof value === 'string' ? JSON.parse(value) : value; } },
  revision: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  entry_installed: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
}, { tableName: 'user_flowcharts', timestamps: true, createdAt: false, updatedAt: 'updated_at' });
