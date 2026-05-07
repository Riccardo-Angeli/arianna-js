#!/usr/bin/env node
/**
 * AriannA build script
 * ──────────────────────────────────────────────────────────────────────────────
 *
 * Usage:
 *   node scripts/build.mjs                  (full build: plain + minified + gz)
 *   node scripts/build.mjs --watch          (esbuild watch mode, no minify/gz)
 *   node scripts/build.mjs --skip-min       (skip the minify+gzip step)
 *   node scripts/build.mjs --skip-meta      (don't copy package.json / README / LICENSE)
 *
 * What it produces in release/dist/, for each of the three bundles
 * (arianna · arianna-components · arianna-additionals):
 *
 *   <name>.js                  (plain ESM bundle)
 *   <name>.js.gz               (gzipped plain)
 *   <name>.min.js              (terser-minified)
 *   <name>.min.js.gz           (gzipped minified)
 *   <name>.min.js.map          (source map for the minified)
 *
 * Plus the publish-ready package.json + README + LICENSE + CHANGELOG.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync,
         statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';
import { minify as terserMinify } from 'terser';

// ── CLI flags ─────────────────────────────────────────────────────────────────
const args     = process.argv.slice(2);
const watch    = args.includes('--watch');
const skipMin  = args.includes('--skip-min')  || watch;
const skipMeta = args.includes('--skip-meta') || watch;

// ── Paths ─────────────────────────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot  = resolve(__dirname, '..');
const outDir    = resolve(repoRoot, 'release', 'dist');

if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

// ── Bundles ───────────────────────────────────────────────────────────────────
//
// `external` keeps cross-bundle imports as runtime imports so each file stays
// independent. components and additionals both depend on the core kernel,
// and reference `arianna` so consumers must also load `arianna.js` first.

const bundles = [
    {
        name    : 'arianna',
        entry   : 'core/index.ts',
        external: ['@tauri-apps/*'],
    },
    {
        name    : 'arianna-components',
        entry   : 'components/index.ts',
        external: ['arianna', '@tauri-apps/*'],
    },
    {
        name    : 'arianna-additionals',
        entry   : 'additionals/index.ts',
        external: ['arianna', '@tauri-apps/*'],
    },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
const sizeOf = (file) => {
    try { return statSync(file).size; } catch { return 0; }
};
const fmtSize = (n) => {
    if (n >= 1024 * 1024) return (n / 1024 / 1024).toFixed(2) + ' MB';
    if (n >= 1024)        return (n / 1024).toFixed(1)        + ' KB';
    return n + ' B';
};

const writeGzip = (srcPath) => {
    const data    = readFileSync(srcPath);
    const gzipped = gzipSync(data, { level: 9 });
    writeFileSync(srcPath + '.gz', gzipped);
    return gzipped.length;
};

// ── 1. esbuild ────────────────────────────────────────────────────────────────
async function buildBundle(bundle) {
    const entry = resolve(repoRoot, bundle.entry);
    if (!existsSync(entry)) {
        console.log(`⚠  ${bundle.entry} not found — skipping ${bundle.name}`);
        return;
    }

    const outfile = resolve(outDir, `${bundle.name}.js`);

    const esbuildOpts = {
        entryPoints  : [entry],
        bundle       : true,
        format       : 'esm',
        platform     : 'browser',
        target       : 'es2022',
        outfile,
        external     : bundle.external,
        sourcemap    : false,
        legalComments: 'eof',
        absWorkingDir: repoRoot,
    };

    if (watch) {
        const ctx = await esbuild.context(esbuildOpts);
        await ctx.watch();
        console.log(`👀 watching → ${outfile}`);
        return;
    }

    await esbuild.build(esbuildOpts);
    console.log(`✓ esbuild → release/dist/${bundle.name}.js  (${fmtSize(sizeOf(outfile))})`);

    if (skipMin) return;

    // ── 2. terser ────────────────────────────────────────────────────────────
    const code   = readFileSync(outfile, 'utf8');
    const minOut = resolve(outDir, `${bundle.name}.min.js`);
    const mapOut = resolve(outDir, `${bundle.name}.min.js.map`);

    const result = await terserMinify(code, {
        ecma     : 2022,
        module   : true,
        compress : { passes: 2 },
        mangle   : true,
        sourceMap: {
            filename: `${bundle.name}.min.js`,
            url     : `${bundle.name}.min.js.map`,
        },
        format   : { comments: false },
    });

    if (result.error) {
        console.error(`❌ terser failed for ${bundle.name}:`, result.error);
        throw result.error;
    }

    writeFileSync(minOut, result.code);
    if (result.map) writeFileSync(mapOut, result.map);

    console.log(`✓ terser  → release/dist/${bundle.name}.min.js  (${fmtSize(sizeOf(minOut))})`);

    // ── 3. gzip ──────────────────────────────────────────────────────────────
    const plainGzSize = writeGzip(outfile);
    const minGzSize   = writeGzip(minOut);
    console.log(`✓ gzip    → release/dist/${bundle.name}.js.gz       (${fmtSize(plainGzSize)})`);
    console.log(`✓ gzip    → release/dist/${bundle.name}.min.js.gz   (${fmtSize(minGzSize)})`);
}

// ── 4. Copy publish-ready meta files ──────────────────────────────────────────
function copyMetaFiles() {
    if (skipMeta) return;

    const candidates = [
        ['package.json',  ['release/package.json', 'dist-package.json', 'package.json']],
        ['README.md',     ['release/README.md',    'dist-README.md',    'README.md']],
        ['LICENSE',       ['release/LICENSE',      'LICENSE']],
        ['CHANGELOG.md',  ['release/CHANGELOG.md', 'CHANGELOG.md']],
    ];

    console.log('');
    for (const [dstName, srcCandidates] of candidates) {
        const src = srcCandidates.find(p => existsSync(resolve(repoRoot, p)));
        if (!src) {
            console.log(`⚠  ${dstName} not found in any candidate path`);
            continue;
        }
        copyFileSync(resolve(repoRoot, src), resolve(outDir, dstName));
        console.log(`✓ meta    → release/dist/${dstName}  (from ${src})`);
    }
}

// ── Main ──────────────────────────────────────────────────────────────────────
(async () => {
    const t0 = Date.now();
    console.log(`⚡ Building AriannA${watch ? ' (watch)' : skipMin ? ' (no minify)' : ''}...`);
    console.log(`  out: ${outDir}`);
    console.log('');

    try {
        for (const bundle of bundles) {
            console.log(`── ${bundle.name} ───────────────────────────────────────`);
            await buildBundle(bundle);
            console.log('');
        }
        copyMetaFiles();

        if (!watch) {
            const ms = Date.now() - t0;
            console.log('');
            console.log(`✓ release/dist build complete in ${ms} ms`);
            console.log(`  → publish with:    npm publish release/dist`);
        }
    } catch (err) {
        console.error('');
        console.error('❌ Build failed:', err?.message || err);
        process.exit(1);
    }
})();
