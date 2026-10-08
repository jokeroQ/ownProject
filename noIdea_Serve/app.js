const express = require('express');
const cors = require('cors');
const { sequelize, Menu, Session, BookmarkTemplate } = require('./models');
const { requireAuth } = require('./middleware/auth');
const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/menu', requireAuth, require('./routes/menuRoutes'));
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  const status = error.status || 500;
  if (status >= 500) console.error(error);
  res.status(status).json({ message: status >= 500 ? '服务器错误，请稍后重试' : error.message, status });
});
async function start() {
  await sequelize.authenticate();
  // No sync({alter:true}): schema changes are explicit, reviewed migrations.
  await Menu.findOne({ attributes: ['id', 'user_id'] });
  await Session.findOne();
  if (!await BookmarkTemplate.findByPk(1)) throw new Error('请先执行 npm run migrate:user-data');
  return app.listen(Number(process.env.PORT || 3000), () => console.log('服务器已启动，数据库和用户模板就绪'));
}
if (require.main === module) start().catch(error => {
  console.error('启动失败，请检查数据库配置并执行迁移：', error.message);
  process.exitCode = 1;
});
module.exports = { app, start };
