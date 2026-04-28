# AriannA — macOS (Tauri 2)

```bash
pnpm install
pnpm tauri dev           # dev with hot-reload
pnpm tauri build         # .app + .dmg in src-tauri/target/release/bundle/

# Open in Xcode (requires cargo-xcode)
cargo install cargo-xcode
cd src-tauri && cargo xcode
open AriannA.xcodeproj
```

**Requirements:** Xcode 15+, Rust stable, Node 20+
