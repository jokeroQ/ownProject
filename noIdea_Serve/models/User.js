// models/User.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/db'); // 引入 Sequelize 连接实例
const User = sequelize.define('User', {
  username: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  }
}, {
  // timestamps: true,  // 自动生成 createdAt 和 updatedAt 字段
  createdAt: 'created_at',  // 映射到数据库中的 created_at 字段
  updatedAt: false
});

module.exports = User;
