const router = require('express').Router();
const service = require('../services/chatService');
const { notifyMessage, notifyRead } = require('../realtime/chatSocket');

router.use((req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });
const respond = operation => async (req, res, next) => {
  try { await operation(req, res); }
  catch (error) { next(error); }
};
const sendWindows = new Map();
const limitSending = (req, res, next) => {
  const now = Date.now();
  if (sendWindows.size > 1000) for (const [id, window] of sendWindows) if (window.until <= now) sendWindows.delete(id);
  let window = sendWindows.get(req.userId);
  if (!window || window.until <= now) {
    window = { count: 0, until: now + 60000 };
    sendWindows.set(req.userId, window);
  }
  if (window.count >= 60) return res.set('Retry-After', String(Math.ceil((window.until - now) / 1000)))
    .status(429).json({ status: 429, message: '发送太快了，请稍后重试' });
  window.count++;
  next();
};

router.get('/users', respond(async (req, res) => res.json({ data: await service.searchUsers(req.userId, req.query.keyword) })));
router.get('/conversations', respond(async (req, res) => res.json({ data: await service.listConversations(req.userId) })));
router.post('/conversations', respond(async (req, res) => res.json({ data: await service.createConversation(req.userId, req.body) })));
router.get('/conversations/:id/messages', respond(async (req, res) => res.json(await service.listMessages(req.userId, req.params.id, req.query))));
router.post('/conversations/:id/messages', limitSending, respond(async (req, res) => {
  const result = await service.sendMessage(req.userId, req.params.id, req.body);
  if (result.created) notifyMessage(result.memberIds, result.message);
  res.status(result.created ? 201 : 200).json({ data: result.message });
}));
router.put('/conversations/:id/read', respond(async (req, res) => {
  const result = await service.markRead(req.userId, req.params.id, req.body);
  notifyRead(result.memberIds, result.receipt);
  res.json({ data: result.receipt });
}));
module.exports = router;
