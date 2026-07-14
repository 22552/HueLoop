import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [
    react(),
    {
      name: "copy-ffmpeg-core",
      closeBundle() {
        const target = resolve("dist/ffmpeg");
        mkdirSync(target, { recursive: true });
        rmSync(resolve(target, "ffmpeg-core.wasm"), { force: true });
        const source = resolve("node_modules/@ffmpeg/core/dist/esm");
        copyFileSync(resolve(source, "ffmpeg-core.js"), resolve(target, "ffmpeg-core.js"));
        // Cloudflare Pages caps individual static files at 25 MiB. Split the
        // 31 MiB wasm binary; the browser joins it before FFmpeg starts.
        const wasm = readFileSync(resolve(source, "ffmpeg-core.wasm"));
        const cut = 16 * 1024 * 1024;
        writeFileSync(resolve(target, "ffmpeg-core.wasm.0"), wasm.subarray(0, cut));
        writeFileSync(resolve(target, "ffmpeg-core.wasm.1"), wasm.subarray(cut));
      },
    },
  ],
});
