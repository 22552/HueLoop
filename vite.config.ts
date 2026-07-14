import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cpSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [
    react(),
    {
      name: "copy-ffmpeg-core",
      closeBundle() {
        const target = resolve("dist/ffmpeg");
        mkdirSync(target, { recursive: true });
        cpSync(resolve("node_modules/@ffmpeg/core/dist/esm"), target, { recursive: true });
      },
    },
  ],
});
