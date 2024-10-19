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
