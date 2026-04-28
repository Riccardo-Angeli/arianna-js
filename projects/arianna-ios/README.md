# AriannA — iOS (Tauri 2)

```bash
pnpm install
pnpm tauri ios init      # initialize iOS project (generates .xcodeproj)
pnpm tauri ios dev       # run on simulator
pnpm tauri ios build     # build for App Store

# Open in Xcode
open src-tauri/gen/apple/AriannA.xcodeproj
```

**Requirements:** macOS + Xcode 15+, iOS Simulator, Rust with target:
```
rustup target add aarch64-apple-ios x86_64-apple-ios aarch64-apple-ios-sim
```

Set YOUR_TEAM_ID in tauri.conf.json → bundle.iOS.developmentTeam
