const express = require('express');
const cors = require('cors');
const { sequelize, User, Menu, MenuList, Session, BookmarkTemplate, UserTheme, UserFlowchart } = require('./models');
const { requireAuth } = require('./middleware/auth');
const app = express();
app.use(cors());
app.use('/api/flowchart', express.json({ limit: '256kb' }));
app.use(express.json());
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/menu', requireAuth, require('./routes/menuRoutes'));
app.use('/api/theme', requireAuth, require('./routes/themeRoutes'));
app.use('/api/flowchart', requireAuth, require('./routes/flowchartRoutes'));
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  const status = error.status || 500;
  if (status >= 500) console.error(error);
  res.status(status).json({ message: status === 413 ? (req.originalUrl.startsWith('/api/flowchart') ? '流程图请求不能超过256KB' : '图片不能超过5MB') : status >= 500 ? '服务器错误，请稍后重试' : error.message, status });
});
async function start() {
  await sequelize.authenticate();
  try {
    await User.findOne({ attributes: ['id', 'role'] });
    await Menu.findOne({ attributes: ['id', 'is_locked'] });
    await MenuList.findOne({ attributes: ['id', 'is_locked'] });
  } catch { throw new Error('权限字段未就绪，请执行 npm run migrate:permissions'); }
  // No sync({alter:true}): schema changes are explicit, reviewed migrations.
  await Menu.findOne({ attributes: ['id', 'user_id'] });
  await Session.findOne();
  try { await UserTheme.findOne(); }
  catch { throw new Error('主题表未就绪，请执行 npm run migrate:themes'); }
  try { await UserFlowchart.findOne(); }
  catch { throw new Error('流程图表未就绪，请执行 npm run migrate:flowcharts'); }
  if (!await BookmarkTemplate.findByPk(1)) throw new Error('请先执行 npm run migrate:user-data');
  return app.listen(Number(process.env.PORT || 3000), () => console.log('服务器已启动，数据库和用户模板就绪'));
}
if (require.main === module) start().catch(error => {
  console.error('启动失败，请检查数据库配置并执行迁移：', error.message);
  process.exitCode = 1;
});
module.exports = { app, start };
