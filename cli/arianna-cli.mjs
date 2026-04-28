#!/usr/bin/env node
/**
 * cli.mjs — AriannA Framework CLI v1.2.0
 * @author  Riccardo Angeli
 * @license MIT / Commercial
 * @copyright Riccardo Angeli 2012–2026
 *
 * Commands:
 *   arianna new <name> [--template browser|tauri|ios|android]
 *   arianna generate <type> <name>   (component|directive|state|test)
 *   arianna serve [--port 3000]
 *   arianna build [--minify]
 *   arianna typecheck
 *   arianna bench
 *   arianna info
 */

import { execSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, readFileSync, cpSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

const __dirname = dirname(fileURLToPath(import.meta.url));
const VERSION   = '1.2.0';

// ── ANSI colours ───────────────────────────────────────────────────────────────
const C = {
  reset : '\x1b[0m',
  bold  : '\x1b[1m',
  dim   : '\x1b[2m',
  pink  : '\x1b[38;2;228;12;136m',
  green : '\x1b[32m',
  red   : '\x1b[31m',
  amber : '\x1b[33m',
  cyan  : '\x1b[36m',
  white : '\x1b[37m',
  gray  : '\x1b[90m',
};
const ok    = (s) => console.log(`${C.green}  ✓${C.reset}  ${s}`);
const warn  = (s) => console.log(`${C.amber}  ⚠${C.reset}  ${s}`);
const err   = (s) => console.error(`${C.red}  ✗${C.reset}  ${s}`);
const info  = (s) => console.log(`${C.cyan}  ℹ${C.reset}  ${s}`);
const hdr   = (s) => console.log(`\n${C.bold}${C.pink}${s}${C.reset}`);
const step  = (s) => console.log(`${C.gray}  →${C.reset} ${s}`);

function logo() {
  console.log(`
${C.bold}${C.pink}   ╔══════════════════════════════╗
   ║  AriannA  CLI  v${VERSION}      ║
   ╚══════════════════════════════╝${C.reset}
${C.gray}   Dedicated to Arianna ♡${C.reset}
`);
}

// ── Argument parsing ───────────────────────────────────────────────────────────
const [,, cmd, ...rest] = process.argv;
const flags = {};
const args  = [];
for (let i = 0; i < rest.length; i++) {
  if (rest[i].startsWith('--')) {
    const [k, v] = rest[i].slice(2).split('=');
    flags[k] = v ?? rest[i + 1] ?? true;
    if (!rest[i].includes('=') && rest[i + 1] && !rest[i + 1].startsWith('--')) i++;
  } else {
    args.push(rest[i]);
  }
}

// ── Templates ─────────────────────────────────────────────────────────────────

const TEMPLATES = {
  browser: (name) => ({
    'index.html': `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${name}</title>
</head>
<body>
  <div id="app"></div>
  <script type="module" src="./src/main.ts"></script>
</body>
</html>`,
    'src/main.ts': `import { Real, State, signal, effect } from '../../arianna-core/index.ts';

const count = signal(0);

const app = new Real('#app')
  .add(
    new Real('h1').text(() => \`Count: \${count.get()}\`),
    new Real('button', { class: 'btn' })
      .push('Increment')
      .on('click', () => count.set(count.get() + 1))
  );
`,
    'tsconfig.json': JSON.stringify({
      compilerOptions: {
        target: 'ES2022', module: 'ESNext', moduleResolution: 'bundler',
        lib: ['ES2022', 'DOM', 'DOM.Iterable'],
        strict: true, noEmit: true, allowImportingTsExtensions: true,
      },
      include: ['src/**/*.ts'],
    }, null, 2),
  }),

  tauri: (name) => ({
    ...TEMPLATES.browser(name),
    'src-tauri/tauri.conf.json': JSON.stringify({
      productName: name, version: '0.1.0',
      build: { beforeBuildCommand: '', beforeDevCommand: '', devUrl: 'http://localhost:3000', frontendDist: '../dist' },
      bundle: { active: true, targets: 'all' },
    }, null, 2),
    'src-tauri/Cargo.toml': `[package]\nname = "${name.toLowerCase().replace(/\s/g,'-')}"\nversion = "0.1.0"\nedition = "2021"\n\n[dependencies]\ntauri = { version = "2", features = [] }\n`,
    'src-tauri/src/lib.rs': `#[cfg_attr(mobile, tauri::mobile_entry_point)]\npub fn run() {\n    tauri::Builder::default().run(tauri::generate_context!()).expect("error running tauri");\n}\n`,
    'src-tauri/src/main.rs': `#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]\nfn main() { ${name.toLowerCase().replace(/\s/g,'_')}_lib::run(); }\n`,
  }),
};

// ── Generator templates ────────────────────────────────────────────────────────

const GENERATORS = {
  component: (name) => `/**
 * @component ${name}
 * @author    Your Name
 */
import Real   from '../../core/Real.ts';
import { signal, effect } from '../../core/Observable.ts';
import type { Signal } from '../../core/Observable.ts';

export interface ${name}Options {
  label?    : string;
  disabled? : boolean;
}

export class ${name} {
  readonly el: HTMLElement;
  #label: Signal<string>;

  constructor(container: string | HTMLElement | null, opts: ${name}Options = {}) {
    this.#label = signal(opts.label ?? '');
    const root = new Real('div', { class: '${name.toLowerCase()}' });
    root.text(() => this.#label.get());
    this.el = root.render() as HTMLElement;

    if (container) {
      const p = typeof container === 'string' ? document.querySelector(container) : container;
      p?.appendChild(this.el);
    }
  }

  set label(v: string) { this.#label.set(v); }
  get label(): string  { return this.#label.get(); }

  destroy(): void { this.el.parentElement?.removeChild(this.el); }
}

export default ${name};
`,

  directive: (name) => `/**
 * @directive a-${name.toLowerCase()}
 */
import { effect } from '../../arianna-core/Observable.ts';

/**
 * a-${name.toLowerCase()} directive.
 *
 * @example
 *   <div a-${name.toLowerCase()}="value"></div>
 *   Directive.${name.toLowerCase()}(el, () => value);
 */
export function ${name.toLowerCase()}(
  el     : Element,
  getter : () => unknown,
): () => void {
  return effect(() => {
    const val = getter();
    // TODO: apply val to el
    (el as HTMLElement).dataset.${name.toLowerCase()} = String(val);
  });
}
`,

  state: (name) => `/**
 * @module ${name}State
 */
import State from '../../core/State.ts';
import { signal, computed } from '../../core/Observable.ts';

export interface ${name}StateShape {
  // define your state shape here
  value: string;
  count: number;
}

const _state = new State<${name}StateShape>({
  value: '',
  count: 0,
});

export const ${name}State = {
  state : _state,
  value : signal(''),
  count : signal(0),
  total : computed(() => ${name}State.count.get() * 2),

  setValue(v: string) { this.value.set(v); _state.State.value = v; },
  increment()         { const n = this.count.get() + 1; this.count.set(n); _state.State.count = n; },
  reset()             { this.value.set(''); this.count.set(0); },
};
`,

  test: (name) => `/**
 * @test ${name}
 */
import { assert, group, run } from '../../arianna-core/index.ts';

await group('${name}', async (t) => {
  t('should work', () => {
    // TODO: add tests
    assert(true, '${name} basic test');
  });
});

run();
`,
};

// ── Commands ──────────────────────────────────────────────────────────────────

async function cmdNew(name, template = 'browser') {
  if (!name) { err('Usage: arianna new <name> [--template browser|tauri|ios|android]'); process.exit(1); }
  if (existsSync(name)) { err(`Directory '${name}' already exists.`); process.exit(1); }

  hdr(`Creating AriannA project: ${name}`);
  const tpl = TEMPLATES[template] ?? TEMPLATES.browser;
  const files = tpl(name);

  for (const [rel, content] of Object.entries(files)) {
    const abs = join(name, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, content, 'utf8');
    ok(rel);
  }

  info(`\nProject created! Next steps:\n`);
  console.log(`   cd ${name}`);
  console.log(`   arianna serve\n`);
}

async function cmdGenerate(type, name) {
  if (!type || !name) {
    err('Usage: arianna generate <component|directive|state|test> <Name>');
    process.exit(1);
  }
  const gen = GENERATORS[type];
  if (!gen) { err(`Unknown generator: ${type}. Use: component | directive | state | test`); process.exit(1); }

  const dir  = type === 'component' ? 'src/components' : type === 'test' ? 'src/tests' : 'src';
  const file = `${dir}/${name}.ts`;
  mkdirSync(dir, { recursive: true });
  if (existsSync(file)) { warn(`${file} already exists — skipping.`); return; }
  writeFileSync(file, gen(name), 'utf8');
  ok(`Generated: ${file}`);
}

async function cmdServe(port = 3000) {
  hdr(`AriannA Dev Server  :${port}`);
  const root = process.cwd();

  const mime = {
    '.html': 'text/html', '.ts': 'application/javascript',
    '.js': 'application/javascript', '.css': 'text/css',
    '.json': 'application/json', '.svg': 'image/svg+xml',
    '.png': 'image/png', '.ico': 'image/x-icon',
  };

  const server = createServer(async (req, res) => {
    let path = req.url.split('?')[0];
    if (path === '/') path = '/index.html';
    const abs = join(root, path);
    const ext = path.slice(path.lastIndexOf('.'));
    try {
      const body = await readFile(existsSync(abs) ? abs : join(root, 'index.html'));
      res.writeHead(200, { 'Content-Type': mime[ext] ?? 'text/plain' });
      res.end(body);
    } catch {
      res.writeHead(404); res.end('Not found');
    }
  });

  server.listen(port, () => {
    ok(`Serving ${root}`);
    info(`http://localhost:${port}`);
  });
}

async function cmdTypecheck() {
  hdr('TypeScript check');
  try {
    execSync('npx tsc --noEmit', { stdio: 'inherit' });
    ok('No TypeScript errors');
  } catch {
    err('TypeScript errors found');
    process.exit(1);
  }
}

async function cmdBuild(minify = false) {
  hdr('AriannA Build');
  try {
    const cmd = `npx esbuild arianna-core/index.ts --bundle --format=esm --outfile=dist/arianna.js${minify ? ' --minify' : ''}`;
    step(cmd);
    execSync(cmd, { stdio: 'inherit' });
    ok('Build complete → dist/arianna.js');
  } catch {
    err('Build failed');
    process.exit(1);
  }
}

async function cmdBench() {
  hdr('AriannA Benchmark');
  info('Opening js-framework-benchmark harness...');
  if (existsSync('arianna-release/benchmark/index.html')) {
    spawn('open', ['arianna-release/benchmark/index.html'], { detached: true });
    ok('Opened arianna-release/benchmark/index.html');
  } else {
    warn('Benchmark files not found. Run from the arianna repo root.');
  }
}

function cmdInfo() {
  logo();
  hdr('Framework Info');
  console.log(`  Version      : ${C.pink}${VERSION}${C.reset}`);
  console.log(`  Author       : Riccardo Angeli`);
  console.log(`  License      : MIT / Commercial`);
  console.log(`  Repo         : https://github.com/riccardo-angeli/arianna`);
  console.log(`  npm          : https://npmjs.com/package/arianna`);
  console.log(`  Dedication   : A mia figlia Arianna ♡`);
  console.log(`\n  ${C.gray}Thanks: Alessandro De Rossi · Simone Ricucci · Alessandro Ligi`);
  console.log(`         Marco Ciurcina · Aurora Castello`);
  console.log(`         Massimiliano Ceaglio · Andrea Giammarchi${C.reset}\n`);
}

function cmdHelp() {
  logo();
  console.log(`${C.bold}Usage:${C.reset}  arianna <command> [options]\n`);
  const cmds = [
    ['new <name>',                  '--template browser|tauri|ios|android'],
    ['generate <type> <Name>',      'component | directive | state | test'],
    ['serve',                       '--port <n>  (default 3000)'],
    ['build',                       '--minify'],
    ['typecheck',                   ''],
    ['bench',                       'open benchmark harness'],
    ['info',                        'show version, author, thanks'],
  ];
  cmds.forEach(([c, d]) =>
    console.log(`  ${C.pink}arianna${C.reset} ${C.bold}${c.padEnd(28)}${C.reset}  ${C.gray}${d}${C.reset}`)
  );
  console.log('');
}

// ── Router ────────────────────────────────────────────────────────────────────

switch (cmd) {
  case 'new':          await cmdNew(args[0], flags.template); break;
  case 'generate':
  case 'gen':
  case 'g':            await cmdGenerate(args[0], args[1]); break;
  case 'serve':
  case 's':            await cmdServe(Number(flags.port) || 3000); break;
  case 'build':
  case 'b':            await cmdBuild(!!flags.minify); break;
  case 'typecheck':
  case 'tc':           await cmdTypecheck(); break;
  case 'bench':        await cmdBench(); break;
  case 'info':         cmdInfo(); break;
  case undefined:
  case 'help':
  case '--help':
  case '-h':           cmdHelp(); break;
  default:             err(`Unknown command: ${cmd}`); cmdHelp(); process.exit(1);
}
