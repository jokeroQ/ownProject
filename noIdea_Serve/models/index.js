const sequelize = require('../config/db');
const db = {
  User: require('./User'),
  Menu: require('./Menu'),
  MenuList: require('./MenuList'),
  Session: require('./Session'),
  BookmarkTemplate: require('./BookmarkTemplate'),
  sequelize,
};
for (const model of Object.values(db)) {
  if (model.associate) model.associate(db);
}
module.exports = db;
