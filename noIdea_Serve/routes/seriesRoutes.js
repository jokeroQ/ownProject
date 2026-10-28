const router = require('express').Router();
const service = require('../services/seriesSearchService');
const library = require('../services/seriesLibraryService');
router.use((req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });
router.get('/library/status', async (req, res, next) => {
  try { res.json({ status: 200, data: await library.status(req.userId) }); } catch (error) { next(error); }
});
router.get('/catalog/status', async (req, res, next) => {
  try { res.json({ status: 200, data: await require('../services/seriesCatalogService').status() }); } catch (error) { next(error); }
});
router.get('/library', async (req, res, next) => {
  try { res.json({ status: 200, data: await library.list(req.userId, req.query) }); } catch (error) { next(error); }
});
router.patch('/library/:id', async (req, res, next) => {
  try { res.json({ status: 200, data: await library.save(req.userId, req.params.id, req.body) }); } catch (error) { next(error); }
});
router.delete('/library/:id', async (req, res, next) => {
  try { res.json({ status: 200, data: await library.remove(req.userId, req.params.id) }); } catch (error) { next(error); }
});
router.get('/', async (req, res, next) => {
  try { res.json({ status: 200, data: await service.search(req.query) }); } catch (error) { next(error); }
});
router.get('/poster', async (req, res, next) => {
  const controller = new AbortController();
  res.on('close', () => { if (!res.writableEnded) controller.abort(); });
  try {
    const image = await require('../services/seriesPosterService').get(req.query.url, controller.signal);
    if (controller.signal.aborted) return;
    res.set({ 'Content-Type': image.type, 'Cache-Control': 'private, max-age=3600', 'X-Content-Type-Options': 'nosniff' });
    res.send(image.body);
  } catch (error) {
    if (controller.signal.aborted || res.destroyed) return;
    const status = error.status || 502;
    res.status(status).json({ status, message: status === 400 ? error.message : '海报暂时无法读取' });
  }
});
router.get('/douban/:id', async (req, res, next) => {
  try { res.json({ status: 200, data: await service.detail(req.params.id) }); }
  catch (error) { if (!error.status) { error.status = 502; error.message = '暂时无法读取作品详情，可前往来源查看'; } next(error); }
});
module.exports = router;
