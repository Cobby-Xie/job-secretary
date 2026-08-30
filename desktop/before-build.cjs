const path = require('node:path');
const fs = require('node:fs');

module.exports = async function beforeBuild(context) {
  const bundle = path.join(context.appDir, 'dist-desktop', 'main.cjs');
  if (!fs.existsSync(bundle)) throw new Error('缺少桌面主进程构建产物，请先运行 pnpm build');
  return false;
};
