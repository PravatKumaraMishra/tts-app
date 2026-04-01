# VoiceDoc — Markdown & Text to Audio

Convert `.md` and `.txt` files to speech directly in your browser.  
**No backend, no API keys, no cost.** Uses the browser's built-in Web Speech API.

## Features
- Upload `.md`, `.txt`, or `.markdown` files
- Paste text directly
- Strips markdown formatting before reading
- Choose from all system voices
- Adjust speed (0.5×–2×) and pitch
- Real-time word highlighting
- Chunked playback for long documents
- Pause / Resume / Stop controls
- Progress tracking

## Deploy to Vercel (3 steps)

### Option A — Vercel CLI
```bash
npm install -g vercel
cd tts-app
npm install
vercel
```
Follow the prompts. Done.

### Option B — GitHub + Vercel Dashboard
1. Push this folder to a GitHub repo
2. Go to https://vercel.com/new
3. Import the repo → Deploy

No environment variables needed.

## Local Development
```bash
npm install
npm run dev
# Open http://localhost:3000
```

## How it works
- Uses `window.SpeechSynthesis` (Web Speech API) — available in Chrome, Edge, Safari, Firefox
- Text is split into ~200-char chunks to avoid browser TTS cutoffs on long documents
- Markdown is stripped to plain text before synthesis
- Everything runs client-side; no data leaves your browser
# tts-app
