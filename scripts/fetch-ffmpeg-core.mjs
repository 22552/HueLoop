import { mkdir, writeFile } from "node:fs/promises";

// Immutable artifact source. This commit was produced by the pinned-source
// build workflow; bump it only after intentionally rebuilding/reviewing core.
const coreCommit = "55b048be46448a13c7c3a3179757a656e52cc7e3";
const base = `https://raw.githubusercontent.com/22552/HueLoop/${coreCommit}/esm`;
const out = "public/ffmpeg-custom";

await mkdir(out, { recursive: true });

for (const name of ["ffmpeg-core.js", "ffmpeg-core.wasm"]) {
  const response = await fetch(base + "/" + name);
  if (!response.ok) throw new Error("Failed to fetch " + name + ": HTTP " + response.status);
  const bytes = new Uint8Array(await response.arrayBuffer());
  await writeFile(out + "/" + name, bytes);
  console.log("Fetched " + name + " from " + coreCommit + ": " + bytes.byteLength + " bytes");
}
