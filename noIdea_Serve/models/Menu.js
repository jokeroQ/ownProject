const { DataTypes } = require('sequelize');
const sequelize = require('../config/db'); // 引入 Sequelize 连接实例

const Menu = sequelize.define('Menu', {
  index: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false
  }
}, {
  // timestamps: true,
  timestamps: false,
  updatedAt: false
});

module.exports = Menu;
