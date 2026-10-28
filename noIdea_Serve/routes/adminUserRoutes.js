const router = require('express').Router();
const controller = require('../controllers/adminUserController');

router.use((req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });
router.get('/', controller.list);
router.patch('/:id', controller.update);
router.put('/:id/password', controller.password);
module.exports = router;
