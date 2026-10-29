const router = require('express').Router();
const service = require('../services/todoService');
router.use((req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });
router.get('/', async (req, res, next) => {
  try { res.json({ status: 200, data: await service.list(req.userId, req.query) }); } catch (error) { next(error); }
});
router.post('/', async (req, res, next) => {
  try { res.status(201).json({ status: 201, data: await service.create(req.userId, req.body) }); } catch (error) { next(error); }
});
router.patch('/:id', async (req, res, next) => {
  try { res.json({ status: 200, data: await service.update(req.userId, req.params.id, req.body) }); } catch (error) { next(error); }
});
router.delete('/completed', async (req, res, next) => {
  try { res.json({ status: 200, data: await service.clearCompleted(req.userId) }); } catch (error) { next(error); }
});
router.delete('/:id', async (req, res, next) => {
  try { res.json({ status: 200, data: await service.remove(req.userId, req.params.id) }); } catch (error) { next(error); }
});
module.exports = router;
