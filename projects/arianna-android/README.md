# AriannA — Android (Tauri 2)

```bash
pnpm install
pnpm tauri android init       # generates Android Studio project
pnpm tauri android dev        # run on emulator / device
pnpm tauri android build      # APK / AAB

# Open in Android Studio
open src-tauri/gen/android
```

**Requirements:** Android Studio, NDK, Rust targets:
```
rustup target add aarch64-linux-android armv7-linux-androideabi x86_64-linux-android i686-linux-android
```

Set ANDROID_HOME and NDK_HOME env vars.
