const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
module.exports = sequelize.define('BookmarkTemplate', {
  id: { type: DataTypes.INTEGER, primaryKey: true },
  content: {
    type: DataTypes.JSON, allowNull: false,
    get() {
      const value = this.getDataValue('content');
      // MariaDB represents JSON as text; MySQL can return a parsed object.
      return typeof value === 'string' ? JSON.parse(value) : value;
    },
  },
}, { tableName: 'bookmark_templates', timestamps: false });
