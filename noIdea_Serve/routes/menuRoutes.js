const express = require('express');
const router = express.Router();
const menuController = require('../controllers/menuController');
router.post('/subMenus/batch', menuController.batchSubMenus);
router.put('/order', menuController.reorderMenus);
const { readMetadata } = require('../services/bookmarkMetadataService');

let metadataActive = 0;
const metadataUsers = new Map();
router.post('/metadata', async (req, res, next) => {
  const active = metadataUsers.get(req.userId) || 0;
  if (metadataActive >= 8 || active >= 2) return res.status(429).json({ message: '获取请求较多，请稍后重试', status: 429 });
  metadataActive++; metadataUsers.set(req.userId, active + 1);
  res.set('Cache-Control', 'private, no-store');
  try { res.json({ data: await readMetadata(req.body?.url), status: 200 }); }
  catch (error) {
    if ([400, 502, 504].includes(error.status)) res.status(error.status).json({ message: error.message, status: error.status });
    else next(error);
  }
  finally {
    metadataActive--;
    const remaining = (metadataUsers.get(req.userId) || 1) - 1;
    if (remaining) metadataUsers.set(req.userId, remaining); else metadataUsers.delete(req.userId);
  }
});

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
router.post('/subMenus/move', menuController.moveSubMenu);

module.exports = router;
