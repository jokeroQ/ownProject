const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const ChatMember = sequelize.define('ChatMember', {
  conversation_id: {
    type: DataTypes.INTEGER, primaryKey: true,
    references: { model: 'chat_conversations', key: 'id' }, onDelete: 'CASCADE',
  },
  user_id: {
    type: DataTypes.INTEGER, primaryKey: true,
    references: { model: 'users', key: 'id' }, onDelete: 'CASCADE',
  },
  last_read_message_id: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
}, {
  tableName: 'chat_members', timestamps: false,
  indexes: [{ fields: ['user_id', 'conversation_id'] }],
  charset: 'utf8mb4', collate: 'utf8mb4_unicode_ci',
});

ChatMember.associate = db => {
  ChatMember.belongsTo(db.ChatConversation, { as: 'conversation', foreignKey: 'conversation_id' });
  ChatMember.belongsTo(db.User, { as: 'user', foreignKey: 'user_id' });
};
module.exports = ChatMember;
