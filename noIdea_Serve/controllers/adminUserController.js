const service = require('../services/adminUserService');

exports.list = async (req, res, next) => {
  try { res.json({ data: await service.listUsers(req.userId, req.query) }); }
  catch (error) { next(error); }
};
exports.update = async (req, res, next) => {
  try { res.json(await service.updateUser(req.userId, req.params.id, req.body)); }
  catch (error) { next(error); }
};
exports.password = async (req, res, next) => {
  try { res.json(await service.resetPassword(req.userId, req.params.id, req.body)); }
  catch (error) { next(error); }
};
