import { mkdir, writeFile } from "node:fs/promises";

const base = "https://fastly.jsdelivr.net/gh/22552/HueLoop@ffmpeg-core/esm";
const out = "public/ffmpeg-custom";
await mkdir(out, { recursive: true });

for (const name of ["ffmpeg-core.js", "ffmpeg-core.wasm"]) {
  const response = await fetch(`${base}/${name}?v=945304d`);
  if (!response.ok) throw new Error(`Failed to fetch ${name}: HTTP ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  await writeFile(`${out}/${name}`, bytes);
  console.log(`Fetched ${name}: ${bytes.byteLength} bytes`);
}
