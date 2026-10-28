const express = require('express');
const router = express.Router();
const themes = require('../services/themeService');
router.use((req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });
const respond = operation => async (req, res, next) => {
  try { res.json({ data: await operation(req), status: 200 }); }
  catch (error) { next(error); }
};
router.get('/', respond(req => themes.get(req.userId)));
router.put('/', respond(req => themes.update(req.userId, req.body)));
router.delete('/', respond(req => themes.removeBackground(req.userId, true)));
router.put('/background', express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: '5mb' }),
  respond(req => {
    let settings;
    if (req.query.settings !== undefined) {
      try {
        if (typeof req.query.settings !== 'string') throw new Error();
        settings = JSON.parse(req.query.settings);
      } catch { throw Object.assign(new Error('主题设置格式不正确'), { status: 400 }); }
    }
    return themes.upload(req.userId, req.body, settings);
  }));
router.delete('/background', respond(req => themes.removeBackground(req.userId)));
router.get('/background', async (req, res, next) => {
  try {
    const buffer = await themes.background(req.userId);
    res.set({ 'Content-Type': 'image/webp', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' }).send(buffer);
  } catch (error) { next(error); }
});
module.exports = router;
