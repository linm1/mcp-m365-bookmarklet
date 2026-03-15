import * as esbuild from 'esbuild';
import { copyFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const isWatch = process.argv.includes('--watch');

const sharedOptions = {
  bundle: true,
  platform: 'browser',
  target: 'es2020',
  minify: !isWatch,
  sourcemap: isWatch ? 'inline' : false,
  logLevel: 'info',
};

const outDir = join(__dirname, 'dist');
if (!existsSync(outDir)) {
  mkdirSync(outDir, { recursive: true });
}

async function build() {
  const bridgeCtx = await esbuild.context({
    ...sharedOptions,
    entryPoints: [join(__dirname, 'src/bridge/index.ts')],
    outfile: join(outDir, 'bridge.js'),
    format: 'iife',
    globalName: '__MCP_BRIDGE__',
  });

  const appCtx = await esbuild.context({
    ...sharedOptions,
    entryPoints: [join(__dirname, 'src/app/app.ts')],
    outfile: join(outDir, 'app.js'),
    format: 'iife',
    globalName: '__MCP_APP__',
  });

  if (isWatch) {
    await bridgeCtx.watch();
    await appCtx.watch();
    console.log('Watching for changes...');
  } else {
    await bridgeCtx.rebuild();
    await appCtx.rebuild();
    await bridgeCtx.dispose();
    await appCtx.dispose();

    // Copy app.html to dist
    const appHtmlSrc = join(__dirname, 'src/app/app.html');
    const appHtmlDest = join(outDir, 'app.html');
    copyFileSync(appHtmlSrc, appHtmlDest);

    console.log('Build complete. Output in dist/');
  }
}

build().catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});
