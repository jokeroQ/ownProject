const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const { User, Session, sequelize } = require('../models');
const { copyDefaults } = require('../services/defaultBookmarks');
const { hashToken } = require('../middleware/auth');
const publicUser = user => ({ id: user.id, username: user.username, email: user.email });

exports.register = async (req, res, next) => {
  const { username, password, email } = req.body;
  if (typeof username !== 'string' || !username.trim() || username.length > 255 ||
      typeof password !== 'string' || !password || Buffer.byteLength(password) > 72 ||
      typeof email !== 'string' || !email.trim() || email.length > 255) {
    return res.status(400).json({ message: '请填写有效的用户名、密码和邮箱', code: 400 });
  }
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await sequelize.transaction(async transaction => {
      if (await User.findOne({ where: { username: username.trim() }, transaction })) {
        const error = new Error('用户名已存在'); error.status = 409; throw error;
      }
      const created = await User.create({ username: username.trim(), password: hashedPassword, email: email.trim() }, { transaction });
      await copyDefaults(created.id, transaction);
      return created;
    });
    res.status(201).json({ message: '用户注册成功', user: publicUser(user), code: 201 });
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      error.status = 409; error.message = '用户名或邮箱已存在';
    }
    next(error);
  }
};

exports.login = async (req, res, next) => {
  const { username, password } = req.body;
  if (typeof username !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ message: '请输入用户名和密码', code: 400 });
  }
  try {
    const user = await User.findOne({ where: { username: username.trim() } });
    if (!user || !await bcrypt.compare(password, user.password)) {
      return res.status(401).json({ message: '用户名或密码错误', code: 401 });
    }
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await Session.create({ token_hash: hashToken(token), user_id: user.id, expires_at: expiresAt });
    res.json({ message: '登录成功', token, expiresAt, user: publicUser(user), code: 200 });
  } catch (error) { next(error); }
};

exports.me = async (req, res, next) => {
  try { res.json({ user: publicUser(await User.findByPk(req.userId)) }); }
  catch (error) { next(error); }
};
exports.logout = async (req, res, next) => {
  try {
    await Session.destroy({ where: { token_hash: req.sessionHash } });
    res.json({ message: '已退出登录', status: 200 });
  } catch (error) { next(error); }
};
