const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

test('本地环境文件从任意目录加载且不覆盖外部测试配置', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ownproject-env-test-'));
  try {
    const file = path.join(directory, 'settings.env');
    fs.writeFileSync(file, "OWNPROJECT_TEST_NAME=local-database\nOWNPROJECT_TEST_PASSWORD='local # password with spaces'\n");
    const modulePath = path.resolve(__dirname, '../config/env.js');
    const child = spawnSync(process.execPath, ['-e', `
      const assert = require('node:assert/strict');
      const { loadLocalEnv } = require(process.argv[1]);
      loadLocalEnv(process.argv[2]);
      assert.equal(process.env.OWNPROJECT_TEST_NAME, 'external-test-database');
      assert.equal(process.env.OWNPROJECT_TEST_PASSWORD, 'local # password with spaces');
      loadLocalEnv(process.argv[2] + '.absent');
      console.log('ok');
    `, modulePath, file], {
      cwd: directory,
      env: { ...process.env, OWNPROJECT_TEST_NAME: 'external-test-database' },
      encoding: 'utf8',
    });
    assert.equal(child.status, 0, child.stderr);
    assert.equal(child.stdout.trim(), 'ok');
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
