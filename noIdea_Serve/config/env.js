const path = require('node:path');
const fs = require('node:fs');

// Resolve from this module so migrations and servers work from any directory.
// Existing environment variables retain priority, including test database names.
function loadLocalEnv(file = path.resolve(__dirname, '../.env')) {
  try {
    fs.accessSync(file, fs.constants.R_OK);
  } catch (error) {
    if (error.code === 'ENOENT') return;
    throw error;
  }
  if (typeof process.loadEnvFile !== 'function') {
    throw new Error('读取本地 .env 需要 Node.js 20.12 或以上版本，请升级 Node.js 后重试');
  }
  process.loadEnvFile(file);
}

loadLocalEnv();
module.exports = { loadLocalEnv };
