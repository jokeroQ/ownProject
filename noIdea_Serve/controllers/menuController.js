const service = require('../services/menuService');
const handler = (operation, message, status = 200) => async (req, res, next) => {
  try {
    const data = await operation(req);
    res.status(status).json({ message, status, data });
  } catch (error) { next(error); }
};
exports.getMenu = handler(req => service.getAllMenuItems(req.userId), '获取菜单成功');
exports.addMenu = handler(req => service.createMenuItem(req.body.title, req.userId), '菜单项已添加', 201);
exports.deleteMenu = handler(req => service.deleteMenuItem(req.params.id, req.userId), '菜单项已删除');
exports.updateMenu = handler(req => service.updateMenuItem(req.params.id, req.body.title, req.userId), '菜单项已更新');
exports.getSubMenus = handler(req => service.getSubMenus(req.params.menuId, req.userId), '获取子菜单成功');
exports.addSubMenu = handler(req => service.createSubMenu(req.params.menuId, req.body, req.userId), '子菜单项已添加', 201);
exports.deleteSubMenu = handler(req => service.deleteSubMenu(req.params.subMenuId, req.userId), '子菜单项已删除');
exports.updateSubMenu = handler(req => service.updateSubMenu(req.params.subMenuId, req.body, req.userId), '子菜单项已更新');
exports.swapMenuOrder = handler(req => service.swapOrder(req.body.firstId, req.body.secondId, req.userId), '位置交换成功');
