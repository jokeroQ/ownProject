const express = require('express');
const cors = require('cors');
const { createServer: createHttpServer } = require('node:http');
const { sequelize, User, Menu, MenuList, Session, BookmarkTemplate, UserTheme, UserFlowchart, ChatConversation, ChatMember, ChatMessage } = require('./models');
const { requireAuth, requireAdmin } = require('./middleware/auth');
const { attachChatSocket } = require('./realtime/chatSocket');
const app = express();
app.use(cors());
app.use('/api/flowchart', express.json({ limit: '256kb' }));
app.use(express.json());
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/admin/users', requireAuth, requireAdmin, require('./routes/adminUserRoutes'));
app.use('/api/menu', requireAuth, require('./routes/menuRoutes'));
app.use('/api/theme', requireAuth, require('./routes/themeRoutes'));
app.use('/api/dinner', requireAuth, require('./routes/dinnerRoutes'));
app.use('/api/todos', requireAuth, require('./routes/todoRoutes'));
app.use('/api/series', requireAuth, require('./routes/seriesRoutes'));
app.use('/api/flowchart', requireAuth, require('./routes/flowchartRoutes'));
app.use('/api/chat', requireAuth, require('./routes/chatRoutes'));
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  const status = error.status || 500;
  if (status >= 500) console.error(error);
  const sizeMessage = req.originalUrl.startsWith('/api/flowchart') ? '流程图请求不能超过256KB'
    : req.originalUrl.startsWith('/api/chat') ? '聊天请求过大，请缩短消息内容'
    : req.originalUrl.startsWith('/api/theme/background') ? '图片不能超过5MB' : '请求内容过大';
  res.status(status).json({ message: status === 413 ? sizeMessage : status >= 500 ? '服务器错误，请稍后重试' : error.message, status });
});
function createServer() {
  const server = createHttpServer(app);
  server.io = attachChatSocket(server);
  return server;
}
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
  try { await ChatConversation.findOne(); await ChatMember.findOne(); await ChatMessage.findOne(); }
  catch { throw new Error('聊天表未就绪，请执行 npm run migrate:chat'); }
  if (!await BookmarkTemplate.findByPk(1)) throw new Error('请先执行 npm run migrate:user-data');
  return createServer().listen(Number(process.env.PORT || 3000), () => console.log('服务器已启动，数据库和用户模板就绪'));
}
if (require.main === module) start().catch(error => {
  console.error('启动失败，请检查数据库配置并执行迁移：', error.message);
  process.exitCode = 1;
});
module.exports = { app, start, createServer };
