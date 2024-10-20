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

// 获取指定菜单的子菜单
router.get('/getSubmenus/:menuId', menuController.getSubMenus); 

// 添加子菜单到指定菜单
router.post('/addSubmenus/:menuId', menuController.addSubMenu); 

// 删除指定的子菜单
router.delete('/deleteSubmenus/:subMenuId', menuController.deleteSubMenu); 

// 更新指定的子菜单
router.put('/updateSubmenus/:subMenuId', menuController.updateSubMenu); 

//更换子菜单的位置
router.post('/subMenus/swap', menuController.swapMenuOrder);

module.exports = router;
