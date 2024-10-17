// config/db.js
const { Sequelize } = require('sequelize');

// 创建 Sequelize 实例，连接 MySQL 数据库
const sequelize = new Sequelize('noIdea', 'root', '1216', {
  host: 'localhost',  // 数据库主机
  dialect: 'mysql',   // 数据库类型
  logging: false      // 禁用 Sequelize 的 SQL 日志输出
});

module.exports = sequelize;
