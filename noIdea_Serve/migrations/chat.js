const { sequelize, ChatConversation, ChatMember, ChatMessage } = require('../models');

async function migrateChat() {
  await sequelize.authenticate();
  // Only create absent chat tables; never alter users or existing application data.
  await ChatConversation.sync();
  await ChatMember.sync();
  await ChatMessage.sync();
  console.log('聊天迁移完成：chat_conversations、chat_members、chat_messages 已就绪。');
}

if (require.main === module) migrateChat().catch(error => {
  console.error('聊天迁移失败：', error.message);
  process.exitCode = 1;
}).finally(() => sequelize.close());
module.exports = migrateChat;
