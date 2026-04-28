#!/usr/bin/env node
/**
 * AriannA build script
 * Usage: node scripts/build.mjs [--minify] [--watch]
 */
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';

const minify  = process.argv.includes('--minify');
const outDir  = 'dist';

if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

const flags = [
  'core/index.ts',
  '--bundle',
  '--format=esm',
  '--platform=browser',
  `--outfile=${outDir}/arianna.js`,
  '--external:@tauri-apps/*',
  minify ? '--minify' : '',
].filter(Boolean).join(' ');

console.log(`⚡ Building AriannA${minify ? ' (minified)' : ''}...`);
try {
  execSync(`npx esbuild ${flags}`, { stdio: 'inherit' });
  
  // Also build components bundle
  execSync(`npx esbuild components/index.ts --bundle --format=esm --platform=browser --outfile=${outDir}/arianna-components.js ${minify ? '--minify' : ''} --external:arianna`, { stdio: 'inherit' });
  
  console.log(`✓ Built → ${outDir}/arianna.js`);
  console.log(`✓ Built → ${outDir}/arianna-components.js`);
} catch {
  console.error('❌ Build failed');
  process.exit(1);
}
