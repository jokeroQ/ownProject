const router = require('express').Router();
const service = require('../services/reportService');
router.use((req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });
router.get('/', async (req, res, next) => {
  try { res.json({ status: 200, data: await service.list(req.userId, req.query) }); } catch (error) { next(error); }
});
router.get('/export', async (req, res, next) => {
  try {
    const result = await service.exportReports(req.userId, req.query);
    res.set('Content-Disposition', `attachment; filename="work-reports.${result.extension}"; filename*=UTF-8''${encodeURIComponent(result.filename)}`);
    res.type(result.contentType).send(result.content);
  } catch (error) { next(error); }
});
router.post('/', async (req, res, next) => {
  try { res.status(201).json({ status: 201, data: await service.create(req.userId, req.body) }); } catch (error) { next(error); }
});
router.put('/:id', async (req, res, next) => {
  try { res.json({ status: 200, data: await service.update(req.userId, req.params.id, req.body) }); } catch (error) { next(error); }
});
router.delete('/:id', async (req, res, next) => {
  try { res.json({ status: 200, data: await service.remove(req.userId, req.params.id) }); } catch (error) { next(error); }
});
module.exports = router;
