"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
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
  const [width, setWidth] = useState(480);
  const [fps, setFps] = useState(12);
  const [output, setOutput] = useState<Output>("gif");
  const [progress, setProgress] = useState(0);
  const [frame, setFrame] = useState(0);
  const [totalFrames, setTotalFrames] = useState(0);
  const [status, setStatus] = useState("Ready when you are");
  const [errorDetail, setErrorDetail] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [engineState, setEngineState] = useState<"preparing" | "ready" | "failed">("preparing");
  const ffmpegRef = useRef<import("@ffmpeg/ffmpeg").FFmpeg | null>(null);
  const loadingRef = useRef<Promise<import("@ffmpeg/ffmpeg").FFmpeg> | null>(null);
  const renderInfoRef = useRef({ fps: 12, totalFrames: 0 });
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => ffmpegRef.current?.terminate(), []);

  const loadFfmpeg = useCallback(async () => {
    if (ffmpegRef.current) return ffmpegRef.current;
    if (loadingRef.current) return loadingRef.current;
    const job = (async () => {
      setEngineState("preparing");
      setErrorDetail("");
      setStatus("Loading FFmpeg JavaScript…");
      setProgress(1);
      const [{ FFmpeg }] = await Promise.all([
        import("@ffmpeg/ffmpeg")
      ]);
      const ffmpeg = new FFmpeg();
      ffmpeg.on("progress", ({ progress: p, time }) => {
        setProgress(Math.min(99, Math.round(p * 100)));
        const { fps, totalFrames } = renderInfoRef.current;
        if (totalFrames) setFrame(Math.min(totalFrames, Math.max(1, Math.floor((time / 1_000_000) * fps) + 1)));
      });
      const coreBase = "/ffmpeg-custom";
      setStatus("Loading FFmpeg Wasm… 0 / about 6.1 MB");
      setProgress(5);
      const wasmURL = `${coreBase}/ffmpeg-core.wasm?v=945304d`;
      const loadPromise = ffmpeg.load({
        coreURL: `${coreBase}/ffmpeg-core.js?v=945304d`,
        wasmURL,
      });
      let timeout: number | undefined;
      try {
        await Promise.race([
          loadPromise,
          new Promise<never>((_, reject) => { timeout = window.setTimeout(() => reject(new Error("FFmpeg load timed out — check your connection or reload")), 90_000); }),
        ]);
      } finally {
        if (timeout) window.clearTimeout(timeout);
      }
      setStatus("Initializing FFmpeg worker…");
      setProgress(90);
      ffmpegRef.current = ffmpeg;
      setEngineState("ready");
      return ffmpeg;
    })();
    loadingRef.current = job;
    try { return await job; }
    catch (error) {
      const detail = error instanceof Error ? `${error.name}: ${error.message}\n${error.stack ?? ""}` : String(error);
      setErrorDetail(detail);
      setStatus(`FFmpeg failed: ${detail}`);
      setEngineState("failed");
      throw error;
    }
    finally { loadingRef.current = null; }
  }, []);

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
    const frameCount = Math.ceil(speed * fps);
    renderInfoRef.current = { fps, totalFrames: frameCount };
    setBusy(true); setProgress(0); setFrame(0); setTotalFrames(frameCount); setStatus(engineState === "ready" ? "Starting the renderer…" : "Preparing the FFmpeg engine…");
    try {
      const [{ fetchFile }, ffmpeg] = await Promise.all([import("@ffmpeg/util"), loadFfmpeg()]);
      const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
      const still = !file.type.includes("gif") && file.type.startsWith("image/");
      const inputName = still ? "input.jpg" : `input.${ext}`;
      const outputName = `hueloop.${output}`;
      setStatus(still ? "Preparing image for rendering…" : "Painting every frame…");
      setProgress(still ? 8 : 15);
      // Let the status paint before decoding a potentially large image.
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      const input = file;
      setStatus("Sending image to renderer…");
      setProgress(15);
      await ffmpeg.writeFile(inputName, await fetchFile(input));
      // Use the filter's radians option. This is FFmpeg's documented form for
      // an uninterrupted hue rotation: one full 2π revolution per loop.
      const hue = `${direction < 0 ? "-" : ""}2*PI*t/${speed}`;
      const scale = `scale=${width}:-2`;
      const color = `hue=H=${hue}:s=${saturation / 100},eq=brightness=${(brightness - 100) / 100}`;
      const args = [
        "-y", ...(still ? ["-loop", "1"] : []), "-i", inputName,
        "-t", String(speed),
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
      // Free the (often much larger) input before copying the result from
      // FFmpeg's in-memory filesystem into the download Blob.
      await ffmpeg.deleteFile(inputName);
      const data = await ffmpeg.readFile(outputName);
      await ffmpeg.deleteFile(outputName);
      const mime = output === "gif" ? "image/gif" : `video/${output}`;
      const blob = new Blob([data as BlobPart], { type: mime });
      if (resultUrl) URL.revokeObjectURL(resultUrl);
      setResultUrl(URL.createObjectURL(blob)); setResultSize(blob.size); setProgress(100);
      setStatus("Your loop is ready");
    } catch (error) {
      console.error(error);
      const detail = error instanceof Error ? `${error.name}: ${error.message}\n${error.stack ?? ""}` : String(error);
      setErrorDetail(detail);
      setStatus(`Rendering failed: ${detail}`);
    } finally { setBusy(false); }
  };

  const previewStyle = {
    "--preview-speed": `${speed}s`,
    "--preview-saturation": `${saturation}%`,
    "--preview-brightness": `${brightness}%`,
    animationDirection: direction === 1 ? "normal" : "reverse",
  } as CSSProperties;

  return (
    <main>
      <style>{`@keyframes previewHue { 0% { filter: hue-rotate(0deg) saturate(var(--preview-saturation)) brightness(var(--preview-brightness)); } 25% { filter: hue-rotate(90deg) saturate(var(--preview-saturation)) brightness(var(--preview-brightness)); } 50% { filter: hue-rotate(180deg) saturate(var(--preview-saturation)) brightness(var(--preview-brightness)); } 75% { filter: hue-rotate(270deg) saturate(var(--preview-saturation)) brightness(var(--preview-brightness)); } 100% { filter: hue-rotate(360deg) saturate(var(--preview-saturation)) brightness(var(--preview-brightness)); } } .animatedPreview { animation: previewHue var(--preview-speed) linear infinite; } .download:disabled { color:#777381; background:#1b1920; border-color:#302d38; cursor:not-allowed; box-shadow:none; }`}</style>
      {engineState === "preparing" && (
        <div className="engineLoader" role="status" aria-live="polite">
          <div className="loaderMark" />
          <p className="loaderKicker">HUELoop IS WARMING UP</p>
          <h2>Preparing your<br />local color lab.</h2>
          <p className="loaderCopy">Downloading the one-time FFmpeg engine<br />so every edit stays on this device.</p>
          <p className="loaderStatus">{status}</p>
          <div className="loaderTrack"><i /></div>
          <small>Usually cached after the first visit · about 6 MB</small>
        </div>
      )}
      {engineState === "failed" && (
        <div className="engineLoader" role="alert">
          <div className="loaderMark" />
          <p className="loaderKicker">FFMPEG COULD NOT START</p>
          <h2>Engine loading failed.</h2>
          <p className="loaderCopy">Reload the page and try again.<br />If it keeps failing, reload the page and try again.</p>
          <pre className="errorDetail">{errorDetail || status}</pre>
          <button className="render" onClick={() => { setEngineState("preparing"); void loadFfmpeg().catch(() => undefined); }}>Retry FFmpeg</button>
        </div>
      )}
      <header className="topbar">
        <a className="brand" href="#top" aria-label="HueLoop home"><span className="brandMark" />HueLoop</a>
        <span className="private"><LockKeyhole size={14} /> {engineState === "ready" ? "local · Pages core 6 MB" : engineState === "failed" ? "engine retry on render" : "preparing engine…"}</span>
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
              {busy ? (
                <div className="renderingPreview"><span className="spinner" />Rendering locally…</div>
              ) : resultUrl ? (
                output === "gif" ? <img src={resultUrl} alt="Rendered rainbow animation" /> : <video src={resultUrl} autoPlay loop muted playsInline />
              ) : file.type.startsWith("video/") ? (
                <video className="animatedPreview" src={sourceUrl} autoPlay loop muted playsInline style={previewStyle} />
              ) : <img className="animatedPreview" src={sourceUrl} alt="Uploaded preview" style={previewStyle} />}
              <div className="fileBadge">{resultUrl ? "Rendered loop" : file.name}</div>
            </div>
          )}
          <input ref={inputRef} hidden type="file" accept="image/*,video/*" onChange={(e) => chooseFile(e.target.files?.[0])}/>
          <div className="statusRow"><span>{busy && frame > 0 ? `Rendering frame ${frame} / ${totalFrames}` : status}</span><span>{busy && frame > 0 ? `${progress}%` : busy && progress === 0 ? "working…" : `${progress}%`}</span></div>
          <div className="progress"><i style={{ width: `${busy && progress === 0 ? 18 : progress}%` }} /></div>
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
          <div className="twoFields"><label><span>Max width</span><select value={width} onChange={(e) => setWidth(+e.target.value)}><option value="480">480 px</option><option value="640">640 px</option><option value="960">960 px</option></select></label><label><span>Frame rate</span><select value={fps} onChange={(e) => setFps(+e.target.value)}><option value="10">10 fps</option><option value="12">12 fps</option><option value="15">15 fps</option><option value="24">24 fps</option></select></label></div>
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
