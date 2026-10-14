import { build } from 'esbuild';

await build({
  entryPoints: ['src/app.mjs'],
  outfile: 'dist/app.js',
  bundle: true,
  minify: true,
  format: 'esm',
  platform: 'browser',
  target: 'chrome130',
  logLevel: 'info',
});
