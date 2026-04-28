#!/usr/bin/env python3
"""Run once to generate placeholder icons before pnpm tauri dev"""
import struct, zlib, os

def make_png(w, h, r=228, g=12, b=136):
    rows = b"".join(b"\x00" + bytes([r,g,b]*w) for _ in range(h))
    def chunk(t, d):
        c = zlib.crc32(t+d) & 0xffffffff
        return struct.pack(">I",len(d)) + t + d + struct.pack(">I",c)
    return (b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB",w,h,8,2,0,0,0))
        + chunk(b"IDAT", zlib.compress(rows))
        + chunk(b"IEND", b""))

os.makedirs("src-tauri/icons", exist_ok=True)
for s in [32, 128, 256, 512, 1024]:
    open(f"src-tauri/icons/{s}x{s}.png","wb").write(make_png(s,s))
open("src-tauri/icons/128x128@2x.png","wb").write(make_png(256,256))
open("src-tauri/icons/icon.png","wb").write(make_png(512,512))
print("Icons created — now run: pnpm tauri icon src-tauri/icons/1024x1024.png")
