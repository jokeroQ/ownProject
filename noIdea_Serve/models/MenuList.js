const { DataTypes } = require('sequelize');
const sequelize = require('../config/db'); // 引入 Sequelize 连接实例

const MenuList = sequelize.define('MenuList', {
  menu_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'menus',
      key: 'id',
    },
  },
  icon: DataTypes.STRING,
  title: DataTypes.STRING,
  type: DataTypes.STRING,
  targetUrl: DataTypes.STRING,
}, {
  timestamps: false,
  updatedAt: false
});

// 添加关联关系
MenuList.associate = (models) => {
  MenuList.belongsTo(models.Menu, {
    foreignKey: 'menu_id',
    // as: 'menu'
  });
};

module.exports = MenuList;
