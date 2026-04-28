# AriannA — Windows (Tauri 2)

```powershell
# Install Rust via rustup.rs
# Install Node 20 + pnpm

pnpm install
pnpm tauri dev
pnpm tauri build    # .exe, .msi in src-tauri\target\release\bundle\
```

**Requirements:** Windows 10+, WebView2 (auto-downloaded), Rust stable, Node 20+
VS Code recommended with rust-analyzer + Tauri extensions.
