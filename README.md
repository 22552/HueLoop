# HueLoop

A browser-based rainbow loop editor powered by FFmpeg.wasm.

Upload an image, GIF, or video and export a hue-cycling GIF, WebM, or MP4. Files are processed locally in the browser; only the FFmpeg engine is downloaded on first use.

## Development

```bash
npm install
npm run dev
```

## Cloudflare Pages

Connect this repository in **Workers & Pages → Create application → Pages → Connect to Git**.

- Build command: `npm run build`
- Build output directory: `dist`
- Node.js version: `22`

No Functions, environment variables, or database are needed.
