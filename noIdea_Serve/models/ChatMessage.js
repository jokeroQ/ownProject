const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const ChatMessage = sequelize.define('ChatMessage', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  conversation_id: {
    type: DataTypes.INTEGER, allowNull: false,
    references: { model: 'chat_conversations', key: 'id' }, onDelete: 'CASCADE',
  },
  sender_id: {
    type: DataTypes.INTEGER, allowNull: false,
    references: { model: 'users', key: 'id' }, onDelete: 'CASCADE',
  },
  client_message_id: { type: DataTypes.STRING(36), allowNull: false },
  content: { type: DataTypes.TEXT, allowNull: false },
  created_at: { type: DataTypes.DATE(3), allowNull: false },
}, {
  tableName: 'chat_messages', createdAt: 'created_at', updatedAt: false,
  indexes: [
    { fields: ['conversation_id', 'id'] },
    { unique: true, fields: ['sender_id', 'client_message_id'], name: 'chat_messages_sender_client_unique' },
  ],
  charset: 'utf8mb4', collate: 'utf8mb4_unicode_ci',
});

ChatMessage.associate = db => {
  ChatMessage.belongsTo(db.ChatConversation, { as: 'conversation', foreignKey: 'conversation_id' });
  ChatMessage.belongsTo(db.User, { as: 'sender', foreignKey: 'sender_id' });
};
module.exports = ChatMessage;
