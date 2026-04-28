# AriannA — Commit Convention

All commits to this repository follow the **Conventional Commits** specification.
This enables automatic changelog generation, semantic versioning, and clean git history.

---

## Format

```
<type>(<scope>): <subject>

[optional body]

[optional footer(s)]
```

- **type** — what kind of change (required)
- **scope** — what part of the codebase (optional, but strongly recommended)
- **subject** — short imperative description, lowercase, no period at end
- **body** — motivation, context, or details (wrap at 72 chars)
- **footer** — breaking changes, issue refs (`Closes #12`, `BREAKING CHANGE: ...`)

---

## Types

| Type | When to use | Bumps version |
|------|-------------|---------------|
| `feat` | New feature for the framework or CLI | minor |
| `fix` | Bug fix | patch |
| `perf` | Performance improvement (no API change) | patch |
| `refactor` | Code change that neither fixes a bug nor adds a feature | patch |
| `docs` | Documentation only | — |
| `style` | Formatting, whitespace, missing semicolons — no logic change | — |
| `test` | Adding or correcting tests | — |
| `chore` | Maintenance: deps, config, build scripts, tooling | — |
| `ci` | CI/CD configuration (GitHub Actions, Husky, etc.) | — |
| `revert` | Reverts a previous commit | — |
| `release` | Version bump commit (automated) | major/minor/patch |

---

## Scopes

Use the folder or module name as scope.

| Scope | Maps to |
|-------|---------|
| `core` | `core/Core.ts`, `core/index.ts` |
| `observable` | `core/Observable.ts` |
| `state` | `core/State.ts` |
| `real` | `core/Real.ts` |
| `virtual` | `core/Virtual.ts` |
| `rule` | `core/Rule.ts` |
| `stylesheet` | `core/Stylesheet.ts` |
| `directive` | `core/Directive.ts` |
| `context` | `core/Context.ts` |
| `namespace` | `core/Namespace.ts` |
| `ssr` | `core/SSR.ts` |
| `workers` | `core/Workers.ts` |
| `jsx` | `core/jsx/` |
| `components` | `components/` (general) |
| `control` | `components/core/Control.ts` |
| `theme` | `components/core/Theme.ts` |
| `table` | `components/data/Table.ts` |
| `treeview` | `components/data/TreeView.ts` |
| `sidebar` | `components/navigation/Sidebar.ts` |
| `additionals` | `additionals/` (general) |
| `animation` | `additionals/Animation.ts` |
| `audio` | `additionals/Audio.ts` |
| `geometry` | `additionals/Geometry.ts` |
| `latex` | `additionals/Latex.ts` |
| `math` | `additionals/Math.ts` |
| `network` | `additionals/Network.ts` |
| `three` | `additionals/Three.ts` |
| `video` | `additionals/Video.ts` |
| `io` | `additionals/IO.ts` |
| `cli` | `cli/arianna-cli.mjs` |
| `config` | `config/arianna.config.ts` |
| `types` | `types/` |
| `scripts` | `scripts/build.mjs` |
| `ci` | `.github/workflows/` |
| `release` | `release/` |
| `projects` | `projects/` |
| `docs` | Documentation, README, CHANGELOG |
| `license` | LICENSE, LICENSES/ |
| `deps` | Dependency updates |

---

## Examples

```bash
# New feature
feat(observable): add signalMono() for zero-allocation TextNode binding

# Bug fix
fix(table): correct _expandedRows Set not cleared on reload

# Performance
perf(real): use direct nodeValue assignment in SignalMono sink

# Refactor
refactor(sidebar): replace _bind with _listen from Control base class

# Breaking change
feat(control)!: rename AriannAControl → Control, ControlOptions → CtrlOptions

BREAKING CHANGE: AriannAControl is now exported as a deprecated alias only.
Update all extends AriannAControl<O> → extends Control<O>.

# Docs
docs(readme): add Signal+Sink benchmark table vs Solid v1.9.3

# Chore
chore(deps): bump typescript from 5.4.5 to 5.6.0

# CI
ci(github): add publish.yml for npm release on git tag v*

# Multiple scopes (use the primary one)
fix(components): correct import paths after core/ restructure

# Revert
revert: feat(math): export AriannaMath as Math alias

Reverts commit a3f8c21.

# Release (automated by CI)
release: v1.2.1
```

---

## Breaking Changes

Prefix the **subject** with `!` and add a `BREAKING CHANGE:` footer:

```
feat(core)!: remove window global registration by default

BREAKING CHANGE: Real, State and Observable are no longer registered
on window automatically. Call Core.use(GlobalsPlugin) to opt in.
```

---

## Rules

- Subject is **imperative, present tense**: "add" not "added", "fix" not "fixed"
- Subject is **lowercase**, no period at the end
- Keep subject under **72 characters**
- Reference issues in footer: `Closes #42`, `Fixes #17`
- One logical change per commit — if you need "and", split into two commits
- `feat` and `fix` appear in the CHANGELOG; other types do not (unless `!`)

---

## Pre-commit hook

The `.husky/pre-commit` hook runs `tsc --noEmit` before every commit.
Zero TypeScript errors are required — the commit is blocked otherwise.

To skip in emergencies only:
```bash
git commit --no-verify -m "wip: ..."
```

---

*© Riccardo Angeli 2012–2026 · AriannA Framework v1.2.0*
*Dedicated with love to Arianna. ♡*
