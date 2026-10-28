const { Server } = require('socket.io');
const { authenticateToken, sessionIdentity } = require('../middleware/auth');

let io;
const userRoom = id => `user:${id}`;
const sessionRoom = hash => `session:${hash}`;
const rejectSession = socket => {
  socket.emit('chat:unauthorized', { message: '登录已失效，请重新登录' });
  socket.disconnect(true);
};

function attachChatSocket(server) {
  const socketServer = new Server(server, {
    cors: { origin: true, methods: ['GET', 'POST'] },
    maxHttpBufferSize: 16 * 1024,
  });
  io = socketServer;
  socketServer.use(async (socket, next) => {
    try {
      const identity = await authenticateToken(socket.handshake.auth?.token);
      if (!identity) {
        const error = new Error('登录已失效，请重新登录');
        error.data = { status: 401 };
        return next(error);
      }
      Object.assign(socket.data, identity);
      next();
    } catch { next(new Error('聊天连接暂时不可用，请稍后重试')); }
  });
  socketServer.on('connection', socket => {
    // Room names always come from the authenticated identity, never from clients.
    socket.join(userRoom(socket.data.userId));
    socket.join(sessionRoom(socket.data.sessionHash));
    const expiration = setTimeout(() => rejectSession(socket), Math.max(1, socket.data.expiresAt - Date.now()));
    expiration.unref();
    socket.on('disconnect', () => clearTimeout(expiration));
  });
  server.once('close', () => {
    if (io === socketServer) io = undefined;
  });
  return socketServer;
}

async function deliver(memberIds, event, payload) {
  const current = io;
  if (!current) return;
  const sockets = await current.in(memberIds.map(userRoom)).fetchSockets();
  const identities = new Map();
  for (const socket of sockets) {
    const hash = socket.data.sessionHash;
    if (!identities.has(hash)) identities.set(hash, sessionIdentity(hash));
    const identity = await identities.get(hash);
    if (!identity || identity.userId !== socket.data.userId) rejectSession(socket);
    else socket.emit(event, payload);
  }
}

// Notification failure must never turn an already committed message into an HTTP failure.
const notify = (members, event, payload) => {
  void deliver(members, event, payload).catch(error => console.error('聊天通知失败：', error.message));
};
function disconnectSession(hash) {
  if (!io) return;
  io.to(sessionRoom(hash)).emit('chat:unauthorized', { message: '登录已失效，请重新登录' });
  io.in(sessionRoom(hash)).disconnectSockets(true);
}

function disconnectUser(userId) {
  if (!io) return;
  io.to(userRoom(userId)).emit('chat:unauthorized', { message: '账号信息已更新，请重新登录' });
  io.in(userRoom(userId)).disconnectSockets(true);
}

module.exports = {
  attachChatSocket,
  disconnectSession,
  disconnectUser,
  notifyMessage: (members, message) => notify(members, 'chat:message', message),
  notifyRead: (members, receipt) => notify(members, 'chat:read', receipt),
};
