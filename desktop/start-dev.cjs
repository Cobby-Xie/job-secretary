const net = require('node:net');
const path = require('node:path');
const { spawn } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const node = process.execPath;
const viteCli = require.resolve('vite/bin/vite.js');
const electron = require('electron');
const vite = spawn(node, [viteCli, '--host', '127.0.0.1', '--port', '4173', '--strictPort'], { cwd: root, stdio: 'inherit' });

function waitForPort(port, attempts = 80) {
  return new Promise((resolve, reject) => {
    const tryConnect = () => {
      const socket = net.createConnection(port, '127.0.0.1');
      socket.once('connect', () => { socket.destroy(); resolve(); });
      socket.once('error', () => { socket.destroy(); if (attempts-- <= 0) reject(new Error('界面服务启动超时')); else setTimeout(tryConnect, 150); });
    };
    tryConnect();
  });
}

waitForPort(4173).then(() => {
  const desktop = spawn(electron, ['.'], { cwd: root, stdio: 'inherit', env: { ...process.env, JOB_SECRETARY_DEV_URL: 'http://127.0.0.1:4173' } });
  desktop.once('exit', (code) => { vite.kill(); process.exit(code || 0); });
}).catch((error) => { console.error(error); vite.kill(); process.exit(1); });
