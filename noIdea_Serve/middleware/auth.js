const crypto = require('node:crypto');
const { Session, User } = require('../models');
const hashToken = token => crypto.createHash('sha256').update(token).digest('hex');
exports.hashToken = hashToken;
// HTTP requests and realtime connections share the same revocable session lookup.
exports.sessionIdentity = async tokenHash => {
  const session = await Session.findByPk(tokenHash);
  if (!session || session.expires_at <= new Date() || !await User.findByPk(session.user_id)) return null;
  return { userId: session.user_id, sessionHash: session.token_hash, expiresAt: new Date(session.expires_at).getTime() };
};
exports.authenticateToken = async token => {
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) return null;
  return exports.sessionIdentity(hashToken(token));
};
exports.requireAuth = async (req, res, next) => {
  const match = /^Bearer ([a-f0-9]{64})$/.exec(req.get('Authorization') || '');
  if (!match) return res.status(401).json({ message: '请先登录', status: 401 });
  try {
    const identity = await exports.authenticateToken(match[1]);
    if (!identity) {
      return res.status(401).json({ message: '登录已失效，请重新登录', status: 401 });
    }
    req.userId = identity.userId;
    req.sessionHash = identity.sessionHash;
    next();
  } catch (error) { next(error); }
};

exports.requireAdmin = async (req, res, next) => {
  try {
    // Permissions come from the current database record, never a cached client profile.
    const user = await User.findByPk(req.userId, { attributes: ['id', 'role'] });
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ message: '仅管理员可管理用户', status: 403 });
    }
    next();
  } catch (error) { next(error); }
};
