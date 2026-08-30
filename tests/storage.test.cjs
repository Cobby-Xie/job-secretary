const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createStorage } = require('../desktop/services/storage.cjs');

test('本地数据可以持久化和恢复', () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'job-secretary-storage-'));
  try {
    const storage = createStorage(temporary);
    storage.set('resume', { name: '测试用户' });
    assert.deepEqual(storage.get('resume'), { name: '测试用户' });
    const backup = storage.readAll();
    storage.set('resume', { name: '修改后' });
    storage.replaceAll(backup);
    assert.deepEqual(storage.get('resume'), { name: '测试用户' });
    assert.equal(fs.existsSync(`${storage.filePath}.tmp`), false);
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});
