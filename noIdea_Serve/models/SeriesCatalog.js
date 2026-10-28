const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
module.exports = sequelize.define('SeriesCatalog', {
  series_id: { type: DataTypes.STRING(100), primaryKey: true },
  source: { type: DataTypes.STRING(32), allowNull: false },
  title: { type: DataTypes.STRING(255), allowNull: false },
  original_title: { type: DataTypes.STRING(255), allowNull: false, defaultValue: '' },
  kind: { type: DataTypes.STRING(16), allowNull: false },
  year: { type: DataTypes.INTEGER, allowNull: true },
  score: { type: DataTypes.FLOAT, allowNull: true },
  release_date: { type: DataTypes.STRING(32), allowNull: false, defaultValue: '' },
  rank: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  genres: { type: DataTypes.JSON, allowNull: false },
  regions: { type: DataTypes.JSON, allowNull: false },
  item: { type: DataTypes.JSON, allowNull: false },
  fetched_at: { type: DataTypes.DATE, allowNull: false },
}, { tableName: 'series_catalog', timestamps: false, indexes: [{ fields: ['source', 'kind'] }, { fields: ['year', 'score'] }] });
