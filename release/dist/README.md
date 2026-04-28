# AriannA

**TypeScript UI framework. Zero dependencies. 7KB gzipped.**

Dedicated with love to Arianna. ♡

```ts
import { Core, Real, State, Directive, Observable } from 'arianna-wip';

// Reactive state
const state = new State({ count: 0, user: 'Arianna' });

// Build UI with Real (incremental DOM)
const btn = new Real('button', { class: 'btn' })
  .set('textContent', '+ Increment')
  .on('click', () => state.State.count++)
  .append('#app');

// React to changes
state.on('State-count-Changed', e => {
  btn.set('textContent', `Count: ${e.Property.New}`);
});

// HTML attribute syntax (no JS needed)
// <div a-if="loggedIn">Welcome, {{ user }}!</div>
// <li a-for="item in items">{{ item }}</li>
// <input a-model="user.name">
Directive.bootstrap(Real('#app'), { loggedIn: true, user: state.State.user });
```

## Bundle size

| File | Raw | Gzipped |
|------|-----|---------|
| `AriannA.ts` (source) | ~40KB | 9KB |
| `AriannA.min.js` | ~30KB | **7KB** |

## Install

```bash
npm install arianna-wip
# or
pnpm add arianna-wip
# or simply copy AriannA.ts — zero dependencies
```

## Modules

| Module | Description |
|--------|-------------|
| `Core` | Global registry, namespace system, plugin host |
| `Observable` | Typed pub/sub event bus |
| `State` | Deep reactive state with StateMachine |
| `Real` | Incremental live DOM builder |
| `Virtual` | Virtual DOM tree with diffing |
| `Component` | Dual-mode custom element + AriannA Component |
| `Directive` | 12 structural directives + HTML `a-*` syntax |
| `Rule` | CSS-in-JS rule builder |
| `Sheet` | CSS-in-JS stylesheet manager |
| `Context` | Scoped dependency injection via DOM |
| `Namespace` | HTML / SVG / MathML / X3D registry |

## Directive HTML syntax

```html
<!-- Conditional -->
<div a-if="loggedIn">Welcome!</div>
<div a-else>Please log in</div>

<!-- List rendering -->
<li a-for="item in items">{{ item.name }}</li>

<!-- Switch -->
<div a-switch="tab">
  <div a-case="home">Home</div>
  <div a-case="docs">Docs</div>
</div>

<!-- Two-way binding -->
<input a-model="user.name">
<select a-model="settings.lang">...</select>

<!-- One-way binding -->
<span a-bind="textContent:username"></span>

<!-- Visibility -->
<nav a-show="menuOpen">...</nav>

<!-- Events -->
<button a-on="click:handleClick">Save</button>

<!-- Template interpolation -->
<p>Hello, {{ username }}! Score: {{ score }}</p>
```

```ts
// One call wires everything
Directive.bootstrap(Real('#app'), scope);
```

## Platforms

Works everywhere JavaScript runs:
- Browser (ES2020+)
- Tauri 2 — macOS, Windows, Linux, iOS, Android
- Node.js 18+ / Deno / Bun
- QuickJS (embedded, RTOS)
- Target: QNX, VxWorks, Green Hills Integrity

## License

AGPL-3.0 for open source / Commercial license for closed-source use.

© 2012–2024 Riccardo Angeli — [arianna.dev](https://arianna.dev)
