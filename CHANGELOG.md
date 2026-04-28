# Changelog

## [1.2.0] — April 2026

### Breaking changes
- `AriannATheme` → `Theme` (deprecated alias still exported)
- `AriannAControl` → `Control` (deprecated alias still exported)
- `ControlOptions` → `CtrlOptions` (deprecated alias still exported)

### New — Signal+Sink fine-grain reactivity
- `signal()`, `signalMono()`, `effect()`, `computed()`, `batch()`, `untrack()`
- `sinkText()`, `sinkClass()` — zero-allocation TextNode/class binding
- Real/VirtualNode: `.text()`, `.textMono()`, `.attr()`, `.cls()`, `.prop()`, `.style()`, `.bind()`

### New — CSS system
- `Rule` v2: structured `SelectorObject` for all @-rule types
- `Sheet` v2: `.Less()` indentation-based Less/Stylus parser, async URL fetch
- Full Golem.Css compatibility: @keyframes, @media, @font-face, @charset, @namespace, @import, @counter-style, @page, @document

### New — JSX Runtime
- Dual Real/Virtual mode per file (`/* @dom-render: virtual */`)
- `$event` and `onEvent` syntax, `jsxDEV()`, `setDefaultRuntime()`

### New — Components
- `Control`: `_state`, `_mounted`, `_fire`, `_listen`, `_onDestroy`, `get<T>()`
- `Theme`: `apply()`, `extend()`, `inject()`, `toggle()`, `watchSystem()`
- `Table`: expandable rows, `rowContent`, `class` option
- `Sidebar`: `ariaLabel`, `class` options

### Performance vs Solid v1.9.3 (Chrome ×4 throttle)
| Benchmark | AriannA | Solid | Δ |
|-----------|---------|-------|---|
| swap rows | 30.5ms | 48.8ms | **−38%** |
| select row | 8.7ms | 11.1ms | **−22%** |
| script swap | 0.1 | 3.3 | **−97%** |
| memory | 2.06MB | 2.64MB | **−22%** |
| bundle gz | 1.5KB | 4.5KB | **3× less** |

## [1.0.0] — April 2026
- Initial TypeScript release — complete migration from JS (2012–2024)
- Core, Real, Virtual, State, Observable, Rule, Stylesheet, Context, Directive, Component, Namespace
- 50 UI controls, zero dependencies, MIT + Commercial dual license
