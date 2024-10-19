const Menu = require('../models/Menu');

// 获取所有菜单项
exports.getAllMenuItems = async () => {
  try {
    const menuItems = await Menu.findAll();  // 使用 Sequelize 查询
    return menuItems;
  } catch (error) {
    console.error('Error fetching menu items:', error);
    throw error;
  }
};

// 创建新的菜单项
exports.createMenuItem = async (title) => {
  const sequelize = Menu.sequelize;
  // 开始一个事务
  const transaction = await sequelize.transaction();
  try {
    const newItem = await Menu.create({ title }, { transaction });

    // 更新 index 为 id 的字符串形式
    newItem.index = newItem.id.toString();
    await newItem.save({ transaction });

    // 提交事务
    await transaction.commit();
    return newItem;
  } catch (error) {
    await transaction.rollback();
    console.error('Error creating menu item:', error);
    throw error;
  }
};

// 删除菜单项
exports.deleteMenuItem = async (id) => {
  try {
    await Menu.destroy({ where: { id } });  // 使用 Sequelize 删除记录
  } catch (error) {
    console.error('Error deleting menu item:', error);
    throw error;
  }
};

// 更新菜单项
exports.updateMenuItem = async (id, index, title) => {
  try {
    await Menu.update({ index, title }, { where: { id } });  // 使用 Sequelize 更新记录
  } catch (error) {
    console.error('Error updating menu item:', error);
    throw error;
  }
};
