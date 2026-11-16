import { build } from 'esbuild';
import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';

await mkdir('dist/web/fonts', { recursive: true });
await copyFile('web/index.html', 'dist/web/index.html');
await copyFile('web/cavli-logo.svg', 'dist/web/cavli-logo.svg');
// The prompt-chips stylesheet first, then the page styles that sit around it.
await writeFile('dist/web/styles.css', (await readFile('web/prompt-chips.css', 'utf8')) + '\n' + (await readFile('web/styles.css', 'utf8')));
for (const file of await readdir('web/fonts')) await copyFile('web/fonts/' + file, 'dist/web/fonts/' + file);
await Promise.all([
  build({ entryPoints: ['web/main.tsx'], bundle: true, minify: true, jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"production"' }, outfile: 'dist/web/app.js' }),
  build({ entryPoints: ['src/worker.ts'], bundle: true, format: 'esm', outfile: 'dist/worker.mjs' }),
]);
