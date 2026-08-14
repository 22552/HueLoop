import { mkdir, writeFile } from "node:fs/promises";

// Immutable artifact source. Bump this commit only after rebuilding/reviewing
// the ffmpeg-core branch output.
const coreCommit = "30d4d16169984ce7a61db32c75e885bf382b7a1c";
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
