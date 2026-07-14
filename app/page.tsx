"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, ImagePlus, LockKeyhole, Play, RotateCcw, Sparkles, Upload, X } from "lucide-react";

type Output = "gif" | "webm" | "mp4";
type Preset = { name: string; saturation: number; brightness: number; speed: number };

const presets: Preset[] = [
  { name: "Prism", saturation: 145, brightness: 100, speed: 3 },
  { name: "Pastel", saturation: 85, brightness: 112, speed: 5 },
  { name: "Neon", saturation: 190, brightness: 106, speed: 2 },
  { name: "Slow glow", saturation: 125, brightness: 104, speed: 8 },
];

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState("");
  const [resultUrl, setResultUrl] = useState("");
  const [resultSize, setResultSize] = useState(0);
  const [speed, setSpeed] = useState(3);
  const [saturation, setSaturation] = useState(145);
  const [brightness, setBrightness] = useState(100);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [width, setWidth] = useState(640);
  const [fps, setFps] = useState(15);
  const [output, setOutput] = useState<Output>("gif");
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("Ready when you are");
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const ffmpegRef = useRef<import("@ffmpeg/ffmpeg").FFmpeg | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => ffmpegRef.current?.terminate(), []);

  const chooseFile = useCallback((next: File | undefined) => {
    if (!next || !(next.type.startsWith("image/") || next.type.startsWith("video/"))) {
      setStatus("Choose an image, GIF, or video file");
      return;
    }
    if (next.size > 100 * 1024 * 1024) {
      setStatus("That file is over the 100 MB limit");
      return;
    }
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    setFile(next);
    setSourceUrl(URL.createObjectURL(next));
    setResultUrl("");
    setProgress(0);
    setStatus(`${next.name} · ${formatBytes(next.size)}`);
  }, [sourceUrl, resultUrl]);

  const reset = () => {
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    setFile(null); setSourceUrl(""); setResultUrl(""); setProgress(0); setStatus("Ready when you are");
  };

  const render = async () => {
    if (!file || busy) return;
    setBusy(true); setProgress(0); setStatus("Loading the local video engine…");
    try {
      const [{ FFmpeg }, { fetchFile, toBlobURL }] = await Promise.all([
        import("@ffmpeg/ffmpeg"), import("@ffmpeg/util")
      ]);
      let ffmpeg = ffmpegRef.current;
      if (!ffmpeg) {
        ffmpeg = new FFmpeg();
        ffmpeg.on("progress", ({ progress: p }) => setProgress(Math.min(99, Math.round(p * 100))));
        const core = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm";
        await ffmpeg.load({
          coreURL: await toBlobURL(`${core}/ffmpeg-core.js`, "text/javascript"),
          wasmURL: await toBlobURL(`${core}/ffmpeg-core.wasm`, "application/wasm"),
        });
        ffmpegRef.current = ffmpeg;
      }
      setStatus("Painting every frame…");
      const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
      const inputName = `input.${ext}`;
      const outputName = `hueloop.${output}`;
      await ffmpeg.writeFile(inputName, await fetchFile(file));
      const still = !file.type.includes("gif") && file.type.startsWith("image/");
      // FFmpeg's hue filter accepts -180°…180°. Map the full 360° cycle into
      // that range; -180° and 180° are identical, so the loop stays smooth.
      const hue = direction * 360 / speed;
      const scale = `scale='min(${width},iw)':-2`;
      const color = `hue=h=mod(${hue}*t+180\,360)-180:s=${saturation / 100},eq=brightness=${(brightness - 100) / 100}`;
      const args = [
        ...(still ? ["-loop", "1"] : []), "-i", inputName,
        ...(still ? ["-t", String(speed)] : []),
        "-vf", `${scale},${color},fps=${fps}`,
      ];
      if (output === "gif") {
        args.push("-filter_complex", `[0:v]${scale},${color},fps=${fps},split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer`, "-loop", "0", outputName);
        const vfAt = args.indexOf("-vf"); args.splice(vfAt, 2);
      } else if (output === "webm") {
        args.push("-an", "-c:v", "libvpx-vp9", "-crf", "35", "-b:v", "0", outputName);
      } else {
        args.push("-an", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart", outputName);
      }
      await ffmpeg.exec(args);
      const data = await ffmpeg.readFile(outputName);
      const mime = output === "gif" ? "image/gif" : `video/${output}`;
      const blob = new Blob([data as BlobPart], { type: mime });
      if (resultUrl) URL.revokeObjectURL(resultUrl);
      setResultUrl(URL.createObjectURL(blob)); setResultSize(blob.size); setProgress(100);
      setStatus("Your loop is ready");
      await Promise.allSettled([ffmpeg.deleteFile(inputName), ffmpeg.deleteFile(outputName)]);
    } catch (error) {
      console.error(error); setStatus("Rendering failed — try a smaller file or WebM output");
    } finally { setBusy(false); }
  };

  const previewStyle = { filter: `hue-rotate(${direction * 180}deg) saturate(${saturation}%) brightness(${brightness}%)` };

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="HueLoop home"><span className="brandMark" />HueLoop</a>
        <span className="private"><LockKeyhole size={14} /> 100% local</span>
      </header>

      <section className="hero" id="top">
        <div className="eyebrow"><Sparkles size={14} /> COLOR, SET IN MOTION</div>
        <h1>Turn anything into<br /><span>a living rainbow.</span></h1>
        <p>Drop an image, GIF, or video. HueLoop spins its colors into a seamless loop—right in your browser.</p>
      </section>

      <section className="studio" aria-label="Rainbow loop editor">
        <div className="canvasColumn">
          {!file ? (
            <button className={`dropzone ${dragging ? "dragging" : ""}`} onClick={() => inputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); chooseFile(e.dataTransfer.files[0]); }}>
              <span className="uploadOrb"><Upload size={28} /></span>
              <strong>Drop something colorful here</strong>
              <span>or tap to browse · PNG, JPG, GIF, WebP, MP4</span>
              <em>Files stay on your device · max 100 MB</em>
            </button>
          ) : (
            <div className="previewFrame">
              <button className="remove" onClick={reset} aria-label="Remove file"><X size={18}/></button>
              {resultUrl ? (
                output === "gif" ? <img src={resultUrl} alt="Rendered rainbow animation" /> : <video src={resultUrl} autoPlay loop muted playsInline />
              ) : file.type.startsWith("video/") ? (
                <video src={sourceUrl} autoPlay loop muted playsInline style={previewStyle} />
              ) : <img className="animatedPreview" src={sourceUrl} alt="Uploaded preview" style={previewStyle} />}
              <div className="fileBadge">{resultUrl ? "Rendered loop" : file.name}</div>
            </div>
          )}
          <input ref={inputRef} hidden type="file" accept="image/*,video/*" onChange={(e) => chooseFile(e.target.files?.[0])}/>
          <div className="statusRow"><span>{status}</span><span>{progress}%</span></div>
          <div className="progress"><i style={{ width: `${progress}%` }} /></div>
        </div>

        <aside className="controls">
          <div className="panelHead"><div><small>LOOP SETTINGS</small><h2>Shape the spectrum</h2></div><button onClick={() => {setSpeed(3);setSaturation(145);setBrightness(100);setDirection(1);}} aria-label="Reset controls"><RotateCcw size={17}/></button></div>
          <label><span>One revolution <b>{speed}s</b></span><input type="range" min="1" max="12" step="0.5" value={speed} onChange={(e) => setSpeed(+e.target.value)}/></label>
          <label><span>Saturation <b>{saturation}%</b></span><input type="range" min="50" max="220" value={saturation} onChange={(e) => setSaturation(+e.target.value)}/></label>
          <label><span>Brightness <b>{brightness}%</b></span><input type="range" min="70" max="130" value={brightness} onChange={(e) => setBrightness(+e.target.value)}/></label>
          <div className="field"><span>Direction</span><div className="segmented"><button className={direction === 1 ? "active" : ""} onClick={() => setDirection(1)}>Forward</button><button className={direction === -1 ? "active" : ""} onClick={() => setDirection(-1)}>Reverse</button></div></div>
          <div className="field"><span>Quick looks</span><div className="presets">{presets.map((p) => <button key={p.name} onClick={() => {setSpeed(p.speed);setSaturation(p.saturation);setBrightness(p.brightness);}}>{p.name}</button>)}</div></div>
          <div className="divider" />
          <div className="field"><span>Output</span><div className="formatRow">{(["gif","webm","mp4"] as Output[]).map((f) => <button key={f} className={output === f ? "active" : ""} onClick={() => setOutput(f)}>{f.toUpperCase()}</button>)}</div></div>
          <div className="twoFields"><label><span>Max width</span><select value={width} onChange={(e) => setWidth(+e.target.value)}><option value="480">480 px</option><option value="640">640 px</option><option value="960">960 px</option></select></label><label><span>Frame rate</span><select value={fps} onChange={(e) => setFps(+e.target.value)}><option value="10">10 fps</option><option value="15">15 fps</option><option value="24">24 fps</option></select></label></div>
          <button className="render" disabled={!file || busy} onClick={render}>{busy ? <><span className="spinner"/>Rendering…</> : <><Play size={18} fill="currentColor"/>Make it rainbow</>}</button>
          <button
            className="download"
            disabled={!resultUrl}
            onClick={() => {
              if (!resultUrl) return;
              const link = document.createElement("a");
              link.href = resultUrl;
              link.download = `hueloop.${output}`;
              link.click();
            }}
          >
            <Download size={18} />
            {resultUrl ? `Download ${output.toUpperCase()} · ${formatBytes(resultSize)}` : "Download your loop"}
          </button>
        </aside>
      </section>

      <footer><span><ImagePlus size={15}/> Image, GIF & video</span><p>No uploads. No accounts. Just color.</p><span>Powered by FFmpeg.wasm</span></footer>
    </main>
  );
}
