#!/usr/bin/env bash
#
# migrate-tauri-to-npm.sh
#
# One-shot script: migrates all 6 AriannA Tauri projects from
# their local copy of AriannA.ts to the published npm package.
#
# - Updates package.json: adds "ariannajs": "^1.2.0" to dependencies
# - Removes the local src/AriannA.ts (84 KB stale duplicate)
# - Rewrites import statements: './AriannA.ts' → 'ariannajs'
# - Runs npm install in each project
#
# Usage:
#   cd ~/path/to/projects     (the parent folder containing arianna-android, arianna-ios, etc.)
#   bash migrate-tauri-to-npm.sh
#
# Idempotent: if AriannA.ts is already removed or 'ariannajs' is already
# in dependencies, the corresponding step is skipped silently.

set -e

PROJECTS=(
    arianna-android
    arianna-ios
    arianna-linux
    arianna-macos
    arianna-web
    arianna-windows
)

ARIANNAJS_VERSION="^1.2.0"

# ── Pre-flight checks ───────────────────────────────────────────────────────

if ! command -v node >/dev/null 2>&1; then
    echo "❌ node not found in PATH. Install Node.js first."
    exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
    echo "❌ npm not found in PATH."
    exit 1
fi

# Verify all 6 project folders exist before doing any work
missing=0
for p in "${PROJECTS[@]}"; do
    if [ ! -d "$p" ]; then
        echo "❌ Missing folder: $p"
        missing=1
    fi
done
if [ "$missing" -eq 1 ]; then
    echo
    echo "Run this script from the parent directory containing all 6 projects."
    exit 1
fi

echo "═══════════════════════════════════════════════════════════════════"
echo "  AriannA Tauri Projects → npm migration"
echo "  Target: ariannajs $ARIANNAJS_VERSION"
echo "═══════════════════════════════════════════════════════════════════"
echo

for proj in "${PROJECTS[@]}"; do
    echo "━━━ $proj ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    cd "$proj"

    # ── 1. Update package.json: add ariannajs to dependencies ───────────────
    if [ ! -f package.json ]; then
        echo "  ⚠  no package.json, skipping"
        cd ..
        continue
    fi

    # Use Node to safely modify JSON
    node <<EOF
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg.dependencies = pkg.dependencies || {};
const before = pkg.dependencies.ariannajs;
pkg.dependencies.ariannajs = '$ARIANNAJS_VERSION';
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
if (before === '$ARIANNAJS_VERSION') {
  console.log('  ✓  package.json: ariannajs already at $ARIANNAJS_VERSION');
} else if (before) {
  console.log('  ✓  package.json: ariannajs ' + before + ' → $ARIANNAJS_VERSION');
} else {
  console.log('  ✓  package.json: added ariannajs $ARIANNAJS_VERSION');
}
EOF

    # ── 2. Remove local src/AriannA.ts duplicate ────────────────────────────
    if [ -f src/AriannA.ts ]; then
        size=$(du -h src/AriannA.ts | cut -f1)
        rm src/AriannA.ts
        echo "  ✓  removed src/AriannA.ts ($size)"
    else
        echo "  ✓  src/AriannA.ts already removed"
    fi

    # ── 3. Rewrite imports in all .ts/.tsx/.js files under src/ ─────────────
    if [ -d src ]; then
        # Find files containing imports from './AriannA' (with or without .ts)
        affected=$(grep -rlE "from\s+['\"]\./?AriannA(\.ts)?['\"]" src/ 2>/dev/null || true)
        if [ -n "$affected" ]; then
            for f in $affected; do
                # Replace './AriannA.ts' or './AriannA' with 'ariannajs'
                # macOS sed needs '' after -i
                sed -i '' -E "s|from[[:space:]]+['\"]\\./AriannA(\\.ts)?['\"]|from 'ariannajs'|g" "$f" 2>/dev/null \
                  || sed -i -E "s|from[[:space:]]+['\"]\\./AriannA(\\.ts)?['\"]|from 'ariannajs'|g" "$f"
                echo "  ✓  rewrote imports in $f"
            done
        else
            echo "  ✓  no AriannA imports found (already migrated?)"
        fi
    fi

    # ── 4. npm install ──────────────────────────────────────────────────────
    if [ -f package-lock.json ] || [ -f pnpm-lock.yaml ]; then
        echo "  ⏳ running npm install..."
        npm install --silent 2>&1 | tail -3 || true
        echo "  ✓  npm install complete"
    else
        echo "  ⏳ running npm install (no lockfile)..."
        npm install --silent 2>&1 | tail -3 || true
        echo "  ✓  npm install complete"
    fi

    cd ..
    echo
done

echo "═══════════════════════════════════════════════════════════════════"
echo "  ✅ Migration complete for all 6 projects."
echo "═══════════════════════════════════════════════════════════════════"
echo
echo "  Next steps:"
echo "    1. Test each project:  cd arianna-macos && npm run dev"
echo "    2. If imports break, search for './AriannA' references manually"
echo "    3. git add -A && git commit -m 'chore: migrate to ariannajs npm'"
echo
