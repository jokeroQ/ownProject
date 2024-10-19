const express = require('express');
const router = express.Router();
const menuController = require('../controllers/menuController');

// 获取菜单列表
router.get('/getMenus', menuController.getMenu);

// 添加菜单项
router.post('/addMenus', menuController.addMenu);

// 删除菜单项
router.delete('/deletMenu/:id', menuController.deleteMenu);

// 更新菜单项
router.put('/updateMenu/:id', menuController.updateMenu);

module.exports = router;
