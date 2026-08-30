const path = require('node:path');
const fs = require('node:fs');
const { app, BrowserWindow, dialog, ipcMain, safeStorage, shell } = require('electron');
const { createStorage } = require('./services/storage.cjs');
const { searchOfficialJobs } = require('./services/job-search.cjs');
const { readDocx, writeResumeDocx } = require('./services/resume-documents.cjs');
const { runAdvisor } = require('./services/ai-advisor.cjs');

let mainWindow;
let storage;
let sessionApiKey = '';

function projectPath(...parts) {
  return path.join(app.getAppPath(), ...parts);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    title: '求职秘书',
    icon: projectPath('resources', '求职秘书-icon.png'),
    width: 1440,
    height: 920,
    minWidth: 1020,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#f4f7fb',
    webPreferences: {
      preload: projectPath('desktop', 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const isLocal = url.startsWith('file:') || url.startsWith('http://127.0.0.1:4173');
    if (!isLocal) { event.preventDefault(); if (/^https?:\/\//i.test(url)) shell.openExternal(url); }
  });

  const developmentUrl = process.env.JOB_SECRETARY_DEV_URL;
  if (developmentUrl) mainWindow.loadURL(developmentUrl);
  else mainWindow.loadFile(projectPath('dist-ui', 'index.html'));
  mainWindow.once('ready-to-show', () => mainWindow.show());
}

function registerHandlers() {
  ipcMain.handle('storage:get', (_event, key) => {
    const value = storage.get(key);
    if (key === 'qs-ai-settings' && value?.apiKeyEncrypted) {
      try {
        sessionApiKey = safeStorage.decryptString(Buffer.from(value.apiKeyEncrypted, 'base64'));
        return { ...value, apiKey: sessionApiKey };
      }
      catch { return { ...value, apiKey: '', apiKeyEncrypted: undefined }; }
    }
    return value;
  });
  ipcMain.handle('storage:set', (_event, key, input) => {
    let value = input;
    if (key === 'qs-ai-settings' && input && typeof input === 'object') {
      value = { ...input };
      const apiKey = String(value.apiKey || ''); delete value.apiKey;
      sessionApiKey = apiKey;
      if (value.rememberKey && apiKey && safeStorage.isEncryptionAvailable()) value.apiKeyEncrypted = safeStorage.encryptString(apiKey).toString('base64');
      else delete value.apiKeyEncrypted;
    }
    storage.set(key, value); return null;
  });
  ipcMain.handle('storage:backup', async () => {
    const result = await dialog.showSaveDialog(mainWindow, { title: '备份求职秘书数据', defaultPath: `求职秘书备份-${new Date().toISOString().slice(0, 10)}.json`, filters: [{ name: 'JSON 备份', extensions: ['json'] }] });
    if (result.canceled || !result.filePath) return { canceled: true };
    const data = storage.readAll();
    if (data.values['qs-ai-settings']) data.values['qs-ai-settings'] = { ...data.values['qs-ai-settings'], apiKey: undefined, apiKeyEncrypted: undefined };
    fs.writeFileSync(result.filePath, JSON.stringify(data, null, 2), 'utf8'); return { canceled: false, path: result.filePath };
  });
  ipcMain.handle('storage:restore', async () => {
    const result = await dialog.showOpenDialog(mainWindow, { title: '恢复求职秘书备份', properties: ['openFile'], filters: [{ name: 'JSON 备份', extensions: ['json'] }] });
    if (result.canceled || !result.filePaths[0]) return { canceled: true };
    const data = JSON.parse(fs.readFileSync(result.filePaths[0], 'utf8')); storage.replaceAll(data);
    return { canceled: false, keys: Object.keys(data.values || {}) };
  });
  ipcMain.handle('jobs:search', (_event, request) => searchOfficialJobs(request, projectPath('resources', 'official-sources.json'), storage.get('qs-custom-sources') || []));
  ipcMain.handle('jobs:add-source', (_event, source) => {
    const url = new URL(source.url);
    if (url.protocol !== 'https:') throw new Error('只接受 HTTPS 企业招聘官网');
    const current = storage.get('qs-custom-sources') || [];
    if (!current.some((item) => item.url === url.toString())) current.push({ name: source.name || `${source.company}招聘官网`, company: source.company, shortName: source.shortName || source.company.slice(0, 1), url: url.toString(), accent: '#1769ea', adapter: 'html', enabled: true });
    storage.set('qs-custom-sources', current); return { count: current.length };
  });
  ipcMain.handle('advisor:run', (_event, task, payload) => {
    const value = storage.get('qs-ai-settings') || {};
    let apiKey = '';
    if (value.apiKeyEncrypted && safeStorage.isEncryptionAvailable()) {
      try { apiKey = safeStorage.decryptString(Buffer.from(value.apiKeyEncrypted, 'base64')); } catch { apiKey = ''; }
    }
    return runAdvisor({ ...value, apiKey: sessionApiKey || apiKey }, task, payload);
  });
  ipcMain.handle('documents:import-docx', async () => {
    const result = await dialog.showOpenDialog(mainWindow, { title: '导入可编辑简历', properties: ['openFile'], filters: [{ name: 'Word 文档', extensions: ['docx'] }] });
    if (result.canceled || !result.filePaths[0]) return { canceled: true };
    const filePath = result.filePaths[0]; return { canceled: false, name: path.basename(filePath), text: await readDocx(filePath) };
  });
  ipcMain.handle('documents:export-docx', async (_event, resume) => {
    const result = await dialog.showSaveDialog(mainWindow, { title: '导出简历', defaultPath: `${resume.name || '我的简历'}.docx`, filters: [{ name: 'Word 文档', extensions: ['docx'] }] });
    if (result.canceled || !result.filePath) return { canceled: true };
    await writeResumeDocx(result.filePath, resume, { templateRoot: projectPath('简历模板') }); return { canceled: false, path: result.filePath };
  });
  ipcMain.handle('system:open-external', (_event, url) => { if (/^https?:\/\//i.test(url)) return shell.openExternal(url); return null; });
  ipcMain.handle('system:info', () => ({ version: app.getVersion(), dataPath: app.getPath('userData'), platform: process.platform }));
}

app.whenReady().then(() => {
  storage = createStorage(app.getPath('userData'));
  registerHandlers(); createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
