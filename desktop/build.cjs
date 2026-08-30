const path = require('node:path');
const fs = require('node:fs');
const esbuild = require('esbuild');

async function run() {
  const root = path.resolve(__dirname, '..');
  const outputDir = path.join(root, 'dist-desktop');
  const { build: buildUi } = await import('vite');

  await buildUi({ root });
  fs.mkdirSync(outputDir, { recursive: true });
  await esbuild.build({
    entryPoints: [path.join(root, 'desktop', 'main.cjs')],
    outfile: path.join(outputDir, 'main.cjs'),
    bundle: true,
    platform: 'node',
    target: 'node22',
    format: 'cjs',
    external: ['electron'],
    sourcemap: false,
    minify: false,
    logLevel: 'info',
  });
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
