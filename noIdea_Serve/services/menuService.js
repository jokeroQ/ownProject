const { Menu, MenuList } = require('../models');
// const Menu = require('../models/Menu');
// const MenuList = require('../models/MenuList')

// 获取所有菜单项
exports.getAllMenuItems = async () => {
  try {
    const menuItems = await Menu.findAll({
      include: [
        {
          model: MenuList,
          as: 'menuLists', // 确保与模型定义中的别名一致
          order: [['order', 'ASC']]
        }
      ],
    });  // 使用 Sequelize 查询
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

// 获取指定菜单的所有子菜单
exports.getSubMenus = async (menuId) => {
  try {
    const subMenus = await MenuList.findAll({ where: { menu_id: menuId } });
    return subMenus;
  } catch (error) {
    console.error('Error fetching sub menus:', error);
    throw error;
  }
};

// 创建子菜单
exports.createSubMenu = async (menuId, data) => {
  try {
    const newSubMenu = await MenuList.create({ menu_id: menuId, ...data });
    return newSubMenu;
  } catch (error) {
    console.error('Error creating sub menu:', error);
    throw error;
  }
};

// 删除子菜单
exports.deleteSubMenu = async (subMenuId) => {
  try {
    await MenuList.destroy({ where: { id: subMenuId } });
  } catch (error) {
    console.error('Error deleting sub menu:', error);
    throw error;
  }
};

// 更新子菜单
exports.updateSubMenu = async (subMenuId, data) => {
  try {
    await MenuList.update(data, { where: { id: subMenuId } });
  } catch (error) {
    console.error('Error updating sub menu:', error);
    throw error;
  }
};
//更换两个项的位置
exports.swapOrder = async (firstId, secondId) => {
  try {
    // 查找两条记录
    const firstMenu = await MenuList.findByPk(firstId);
    const secondMenu = await MenuList.findByPk(secondId);

    if (!firstMenu || !secondMenu) {
      throw new Error('其中一个菜单项未找到');
    }

    // 交换它们的 order 值
    const tempOrder = firstMenu.order;
    firstMenu.order = secondMenu.order;
    secondMenu.order = tempOrder;

    // 保存更改
    await firstMenu.save();
    await secondMenu.save();
  } catch (error) {
    console.error('Error swapping menu items order:', error);
    throw error;
  }
};
