const router = require('express').Router();
const service = require('../services/dinnerService');
router.get('/', async (req, res, next) => {
  try { res.json({ status: 200, data: await service.get(req.userId) }); } catch (error) { next(error); }
});
router.put('/', async (req, res, next) => {
  try { res.json({ status: 200, data: await service.save(req.userId, req.body.options) }); } catch (error) { next(error); }
});
module.exports = router;
