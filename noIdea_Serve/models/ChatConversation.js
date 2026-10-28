const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const ChatConversation = sequelize.define('ChatConversation', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  direct_key: { type: DataTypes.STRING(64), allowNull: false, unique: true },
  last_message_id: { type: DataTypes.INTEGER, allowNull: true },
  created_at: { type: DataTypes.DATE(3), allowNull: false },
  updated_at: { type: DataTypes.DATE(3), allowNull: false },
}, {
  tableName: 'chat_conversations',
  createdAt: 'created_at', updatedAt: 'updated_at',
  charset: 'utf8mb4', collate: 'utf8mb4_unicode_ci',
});

ChatConversation.associate = db => {
  ChatConversation.hasMany(db.ChatMember, { as: 'members', foreignKey: 'conversation_id' });
  ChatConversation.belongsTo(db.ChatMessage, {
    as: 'lastMessage', foreignKey: 'last_message_id', constraints: false,
  });
};
module.exports = ChatConversation;
