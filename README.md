<div align="center">

# AriannA

**Fine-grain reactive UI framework**

*Dedicated with love to my daughter Arianna ♡*

[![npm version](https://img.shields.io/npm/v/arianna?color=%23e40c88&style=flat-square)](https://www.npmjs.com/package/arianna)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue?style=flat-square)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green?style=flat-square)](./LICENSES/MIT.txt)
[![Zero deps](https://img.shields.io/badge/dependencies-0-brightgreen?style=flat-square)](package.json)

[Documentation](https://arianna.dev) · [npm](https://www.npmjs.com/package/arianna) · [Changelog](./CHANGELOG.md) · [GitHub](https://github.com/Riccardo-Angeli/AriannA-Js)

**A**dvanced **R**eactive **I**nterface **A**rchitecture & **N**ext-gen **N**ode **A**ssets

</div>

---

AriannA is a TypeScript UI framework built around **Signal+Sink fine-grain reactivity** — only the exact DOM node that depends on a signal updates. No component re-render, no VDOM diffing, zero dependencies. Plus a complete batteries-included layer: 50+ controls, 11 finance components, 20 mesh modifiers, 2D/3D renderers, neural nets, audio/video, CLI, JSX, SSR.

## Performance vs Solid v1.9.3

| Benchmark | AriannA | Solid | Δ Total | Δ Script |
|-----------|---------|-------|---------|----------|
| create 1k | 82.5ms | 80.6ms | +2% | −2% |
| replace 1k | 89.3ms | 90.2ms | −1% | −11% |
| update 10th | 40.5ms | 40.2ms | ≈ | **−54%** |
| select row | 8.7ms | 11.1ms | **−22%** | **−91%** |
| swap rows | 30.5ms | 48.8ms | **−38%** | **−97%** |
| remove row | 37.1ms | 38.1ms | −3% | −85% |
| create 10k | 874ms | 839ms | +4% | +23% |
| memory | **2.06 MB** | 2.64 MB | **−22%** | — |
| bundle (gz) | **1.5 KB** | 4.5 KB | **3× less** | — |

*Mac M-series · Chrome ×4 throttle · js-framework-benchmark keyed*

## Install

```bash
npm install arianna
# or
npx arianna new my-app
```

## Quick start

```ts
import { Real, signal, effect } from 'arianna';

const count = signal(0);

const btn = new Real('button')
  .text(() => `Clicked ${count.get()} times`)
  .on('click', () => count.set(count.get() + 1))
  .append(document.body);
```

## Signals

```ts
import { signal, signalMono, effect, computed, batch, sinkText } from 'arianna';

const name  = signal('AriannA');
const upper = computed(() => name.get().toUpperCase());

effect(() => console.log(upper.get())); // runs immediately, re-runs on change

batch(() => {
  name.set('Hello');
  name.set('World');
}); // single effect flush

// Zero-allocation TextNode binding
const mono = signalMono('initial');
sinkText(mono, myTextNode); // → node.nodeValue = value on every set()
```

## Signal+Sink on Real DOM

```ts
import { Real, signal } from 'arianna';

const loading = signal(false);
const color   = signal('#e40c88');

new Real('div')
  .text(() => `Status: ${loading.get() ? 'loading…' : 'ready'}`)
  .cls('loading', () => loading.get())
  .style('color', () => color.get())
  .attr('disabled', () => loading.get() ? '' : null)
  .append(document.body);
```

## JSX

```json
// tsconfig.json
{ "compilerOptions": { "jsx": "react-jsx", "jsxImportSource": "arianna" } }
```

```tsx
function App() {
  const count = signal(0);
  return (
    <div>
      <p>Count: <span>{count.get()}</span></p>
      <button onClick={() => count.set(count.get() + 1)}>+</button>
    </div>
  );
}
```

## CSS — Rule & Sheet

```ts
import { Rule, Sheet } from 'arianna';

const sheet = new Sheet();
sheet
  .add(new Rule('.btn', { background: '#e40c88', color: '#fff', padding: '6px 14px' }))
  .add(new Rule('.btn:hover', { filter: 'brightness(1.1)' }))
  .add(new Rule('@keyframes fadeIn', { from: { opacity: '0' }, to: { opacity: '1' } }))
  .add(new Rule('@media (max-width: 768px)', '.btn { width: 100% }'))
  .attach();

// Less/Stylus parser
const css = Sheet.Less(`
@primary: #e40c88;
.card
  border-radius: 4px
  &:hover
    border-color: @primary
`);
```

## Controls — 50+ ready-made

```ts
import { Table, TreeView, Theme } from 'arianna/components';

Theme.apply(Theme.Dark);

const table = new Table('#container', {
  columns: [
    { key: 'name',  label: 'Name',  sortable: true },
    { key: 'email', label: 'Email', sortable: true },
  ],
  paging: { pageSize: 25 },
});
table.load(data).mount();
```

| Category | Controls |
|---|---|
| **inputs** (15) | Button · Checkbox · ColorPicker · DatePicker · Dropdown · FileUpload · Radio · RangeSlider · Rating · SearchBar · Switch · TextField · TimePicker · ColorPicker · ChipInput |
| **display** (13) | Avatar · Badge · Banner · Card · Chip · Divider · Icon · Modal · ProgressBar · ProgressCircular · Skeleton · Snackbar · Tooltip |
| **layout** (10) | Accordion · Drawer · Header · Panel · Splitter · Stepper · Tabs · Tag · List · Sidebar |
| **navigation** (7) | Breadcrumb · Menu · NavRail · Pagination · Splitter · Stepper · Tabs |
| **charts** (3) | BarChart · LineChart · PieChart |
| **data** (2) | Table · TreeView |

## Finance components — 11 chart primitives, pure SVG/HTML

```ts
import { CandlestickChart, RiskGauge } from 'arianna/components/finance';

new CandlestickChart('#chart').render(bars);    // OHLCV + volume
new RiskGauge('#g', { size: 200 }).render(0.7); // semi-circle gauge
```

`CandlestickChart` · `LineChart` · `DepthChart` · `HeatmapChart` · `PortfolioDonut` · `PnLChart` · `RiskGauge` · `OrderBook` · `Screener` · `Sparkline` · `AlertBadge`

## Modifiers

**2D — interactive wrappers for any HTML element**

```ts
import { Resizer, Rotator } from 'arianna/components/modifiers/2D';

new Resizer('.box', { minWidth: 100, handleColor: '#e40c88' })
  .onResize((el, w, h) => console.log(w, h));
new Rotator('.box', { snap: 15 });
```

`Resizer` · `Rotator` · `Skewer` · `Rounder` · `Reflector`

**3D — geometry transforms for any mesh-like object**

```ts
import { SubdivisionModifier, BendModifier } from 'arianna/components/modifiers/3D';

new SubdivisionModifier(mesh, 2).apply();
new BendModifier(mesh, Math.PI / 4, 'y').apply();
```

`SubdivisionModifier` · `DecimateModifier` · `BevelModifier` · `MirrorModifier` · `ArrayModifier` · `BendModifier` · `TwistModifier` · `WaveModifier` · `InflateModifier` · `SmoothModifier` · `DragModifier` · `SnapModifier` · `LODModifier` · `FadeModifier` · `BillboardModifier`

## Additionals — domain modules

```ts
import { Finance, Two, AI, IO, Audio } from 'arianna/additionals';
```

| Module | What it does |
|---|---|
| **Math** | Numerical primitives, vectors, matrices, noise |
| **Geometry** | AABB, Ray, intersections, hulls |
| **Two** | 2D scene graph: SVG/Canvas renderer, shapes, tweens, easings, scaleLinear/scaleBand |
| **Three** | 3D scene graph: WebGL renderer, mesh, materials |
| **Animation** | Tween, Timeline, AnimationLoop, easings |
| **Finance** | BlackScholes · Bachelier · Heston · MonteCarlo · Indicators (SMA/EMA/RSI/MACD) · Portfolio · Backtest |
| **AI** | Tensor · Layers (Dense/Conv/Attention/GRU) · Sequential · Transformer · Tokenizer · MarkovChain |
| **Data** | FSM · DAG · Trie · PriorityQueue · LRUCache |
| **Audio** | AudioEngine · Oscillator · Synth · effects chain |
| **Video** | VideoPlayer · ScreenCapture · CameraCapture · GIFEncoder |
| **IO** | FileIO · FSAccess · Http · SSE · WebSocketIO · LocalStore · IDBIO · Clipboard · Share |
| **Network** | Fetch wrappers, SSE, WebSocket, retry/backoff |
| **Workers** | WorkerPool, message-passing helpers |
| **Latex** | LaTeX → SVG / MathML rendering |
| **Docs** | In-repo doc-page generator |
| **SSR** | renderToString, renderToStream, hydrate, Island architecture |

## CLI

```bash
arianna new my-app                    # scaffold browser project
arianna new my-app --template tauri   # Tauri desktop
arianna generate component MyCard     # generate component
arianna serve                         # dev server :3000
arianna build --minify                # bundle
arianna typecheck                     # tsc --noEmit
arianna info                          # version + credits
```

## Repo layout

```
arianna/
├─ core/                  Core · Real · Virtual · State · Observable · Rule · Sheet · ...
├─ components/
│  ├─ inputs/             Button, TextField, Checkbox, ...
│  ├─ display/            Card, Modal, Tooltip, ...
│  ├─ layout/             Accordion, Splitter, Tabs, ...
│  ├─ navigation/         Menu, Pagination, Breadcrumb, ...
│  ├─ charts/             BarChart, LineChart, PieChart
│  ├─ data/               Table, TreeView
│  ├─ finance/            CandlestickChart, RiskGauge, OrderBook, ...
│  └─ modifiers/
│     ├─ 2D/              Resizer, Rotator, Skewer, Rounder, Reflector
│     └─ 3D/              Subdivision, Decimate, Bend, Twist, ...
├─ additionals/           AI, Finance, Two, Three, Animation, IO, Audio, Video, ...
├─ cli/                   `arianna` command
├─ projects/              Tauri / Vite / Web templates
├─ release/               Built bundles + benchmarks
└─ types/                 Shared type declarations
```

## License

Dual-licensed: **MIT** (open source) + **Commercial** (closed source / enterprise).
See [LICENSES/](./LICENSES/) for details. Commercial licensing: [arianna.dev/licensing](https://arianna.dev/licensing).

---

*© Riccardo Angeli 2012–2026 · Zurich, Switzerland*
*Thanks: Alessandro De Rossi · Simone Ricucci · Alessandro Ligi · Marco Ciurcina · Aurora Castello · Massimiliano Ceaglio · Andrea Giammarchi*
