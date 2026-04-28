# AriannA — Linux (Tauri 2)

## Quick start

```bash
# 1. Install system dependencies (Ubuntu/Debian)
sudo apt install libwebkit2gtk-4.1-dev libssl-dev libgtk-3-dev \
  libayatana-appindicator3-dev librsvg2-dev

# 2. Install Node deps
pnpm install

# 3. Generate icons (once)
python3 generate-icons.py
pnpm tauri icon src-tauri/icons/1024x1024.png

# 4. Dev mode with hot-reload
pnpm tauri dev

# 5. Build for distribution
pnpm tauri build
# → .deb, .rpm, .AppImage in src-tauri/target/release/bundle/
```

## Requirements
- Rust stable (`curl --proto =https --tlsv1.2 -sSf https://sh.rustup.rs | sh`)
- Node 20+ with pnpm (`npm install -g pnpm`)
- WebKit2GTK 4.1 (see apt command above)

## Rust Rover
Open `src-tauri/` as a Cargo project in Rust Rover.
Set run configuration: `cargo run` in `src-tauri/`.
