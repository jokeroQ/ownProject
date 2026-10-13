const router = require('express').Router();
const service = require('../services/flowchartService');
router.use((req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });
const respond = operation => async (req, res, next) => {
  try { res.json({ data: await operation(req), status: 200 }); }
  catch (error) { next(error); }
};
router.get('/', respond(req => service.get(req.userId)));
router.put('/', respond(req => service.save(req.userId, req.body)));
router.post('/entry', respond(req => service.installEntry(req.userId)));
module.exports = router;
