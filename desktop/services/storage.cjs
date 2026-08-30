const fs = require('node:fs');
const path = require('node:path');

function createStorage(dataDirectory) {
  const filePath = path.join(dataDirectory, 'job-secretary-data.json');

  function ensureDirectory() {
    fs.mkdirSync(dataDirectory, { recursive: true });
  }

  function readAll() {
    ensureDirectory();
    if (!fs.existsSync(filePath)) return { version: 1, values: {} };
    try {
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (!parsed || typeof parsed !== 'object' || typeof parsed.values !== 'object') throw new Error('invalid data file');
      return parsed;
    } catch (error) {
      const damagedPath = `${filePath}.damaged-${Date.now()}`;
      fs.copyFileSync(filePath, damagedPath);
      return { version: 1, values: {}, recoveryNotice: path.basename(damagedPath) };
    }
  }

  function writeAll(data) {
    ensureDirectory();
    const temporaryPath = `${filePath}.tmp`;
    fs.writeFileSync(temporaryPath, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(temporaryPath, filePath);
  }

  return {
    filePath,
    get(key) {
      return readAll().values[key] ?? null;
    },
    set(key, value) {
      const data = readAll();
      data.values[key] = value;
      data.updatedAt = new Date().toISOString();
      writeAll(data);
    },
    readAll,
    replaceAll(data) {
      if (!data || typeof data !== 'object' || typeof data.values !== 'object') throw new Error('备份文件结构不正确');
      writeAll({ version: 1, ...data, restoredAt: new Date().toISOString() });
    },
  };
}

module.exports = { createStorage };
