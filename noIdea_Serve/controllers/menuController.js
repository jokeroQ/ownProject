const menuService = require('../services/menuService');

// 获取菜单列表
exports.getMenu = async (req, res) => {
    try {
        const menu = await menuService.getAllMenuItems();
        res.json({ data: menu, status: 200, message: "获取菜单成功" });
    } catch (error) {
        res.status(500).json({ message: '获取菜单失败', error: error.message });
    }
};

// 添加菜单项
exports.addMenu = async (req, res) => {
    const { title } = req.body;
    try {
        const newItem = await menuService.createMenuItem(title);
        res.status(201).json({ message: '菜单项已添加', newItem });
    } catch (error) {
        res.status(400).json({ message: '添加菜单项失败', error: error.message });
    }
};

// 删除菜单项
exports.deleteMenu = async (req, res) => {
    const id = req.params.id;
    try {
        await menuService.deleteMenuItem(id);
        res.json({ message: '菜单项已删除',status:200 });
    } catch (error) {
        res.status(500).json({ message: '删除菜单项失败', error: error.message,status:500 });
    }
};

// 更新菜单项
exports.updateMenu = async (req, res) => {
    const id = req.params.id;
    const { index, title } = req.body;
    try {
        await menuService.updateMenuItem(id, index, title);
        res.json({ message: '菜单项已更新' });
    } catch (error) {
        res.status(500).json({ message: '更新菜单项失败', error: error.message });
    }
};

// 获取指定菜单的子菜单
exports.getSubMenus = async (req, res) => {
    const menuId = req.params.menuId;
    try {
        const subMenus = await menuService.getSubMenus(menuId);
        res.json({ data: subMenus, status: 200, message: "获取子菜单成功" });
    } catch (error) {
        res.status(500).json({ message: '获取子菜单失败', error: error.message });
    }
};

// 添加子菜单
exports.addSubMenu = async (req, res) => {
    const menuId = req.params.menuId;
    const { title, icon, type, targetUrl } = req.body;
    try {
        const newSubMenu = await menuService.createSubMenu(menuId, { title, icon, type, targetUrl });
        res.status(201).json({ message: '子菜单项已添加', newSubMenu,status:200 });
    } catch (error) {
        res.status(400).json({ message: '添加子菜单项失败', error: error.message });
    }
};

// 删除子菜单
exports.deleteSubMenu = async (req, res) => {
    const subMenuId = req.params.subMenuId;
    try {
        await menuService.deleteSubMenu(subMenuId);
        res.json({ message: '子菜单项已删除', status: 200 });
    } catch (error) {
        res.status(500).json({ message: '删除子菜单项失败', error: error.message, status: 500 });
    }
};

// 更新子菜单
exports.updateSubMenu = async (req, res) => {
    const subMenuId = req.params.subMenuId;
    const { title, icon, type, targetUrl } = req.body;
    try {
        await menuService.updateSubMenu(subMenuId, { title, icon, type, targetUrl });
        res.json({ message: '子菜单项已更新', status: 200 });
    } catch (error) {
        res.status(500).json({ message: '更新子菜单项失败', error: error.message });
    }
};
//更换菜单位置
exports.swapMenuOrder = async (req, res) => {
    const { firstId, secondId } = req.body;
    try {
        await menuService.swapOrder(firstId, secondId);
        res.json({ message: '菜单项位置已调换', status: 200 });
    } catch (error) {
        res.status(500).json({ message: '调换位置失败', error: error.message });
    }
};