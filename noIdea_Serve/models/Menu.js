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
  timestamps: false,
  updatedAt: false
});

// 添加关联关系
Menu.associate = (models) => {
  Menu.hasMany(models.MenuList, {
    foreignKey: 'menu_id',
    // as: 'menuLists' // 确保与 MenuService.js 中一致
  });
};

module.exports = Menu;
