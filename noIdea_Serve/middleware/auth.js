const crypto = require('node:crypto');
const { Session, User } = require('../models');
const hashToken = token => crypto.createHash('sha256').update(token).digest('hex');
exports.hashToken = hashToken;
exports.requireAuth = async (req, res, next) => {
  const match = /^Bearer ([a-f0-9]{64})$/.exec(req.get('Authorization') || '');
  if (!match) return res.status(401).json({ message: '请先登录', status: 401 });
  try {
    const session = await Session.findByPk(hashToken(match[1]));
    if (!session || session.expires_at <= new Date() || !await User.findByPk(session.user_id)) {
      return res.status(401).json({ message: '登录已失效，请重新登录', status: 401 });
    }
    req.userId = session.user_id;
    req.sessionHash = session.token_hash;
    next();
  } catch (error) { next(error); }
};
