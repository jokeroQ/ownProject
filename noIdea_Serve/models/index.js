const sequelize = require('../config/db');
const db = {
  User: require('./User'),
  Menu: require('./Menu'),
  MenuList: require('./MenuList'),
  Session: require('./Session'),
  BookmarkTemplate: require('./BookmarkTemplate'),
  UserTheme: require('./UserTheme'),
  UserPreference: require('./UserPreference'),
  UserTodo: require('./UserTodo'),
  UserReport: require('./UserReport'),
  UserSeries: require('./UserSeries'),
  SeriesCatalog: require('./SeriesCatalog'),
  UserFlowchart: require('./UserFlowchart'),
  ChatConversation: require('./ChatConversation'),
  ChatMember: require('./ChatMember'),
  ChatMessage: require('./ChatMessage'),
  sequelize,
};
for (const model of Object.values(db)) {
  if (model.associate) model.associate(db);
}
module.exports = db;
