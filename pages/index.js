import Head from 'next/head'
import { useState, useRef, useEffect, useCallback } from 'react'

// Strip markdown to plain text for TTS
function stripMarkdown(text) {
  return text
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`{1,3}[\s\S]*?`{1,3}/g, '')
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/^[-*+]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/^>\s+/gm, '')
    .replace(/^---+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export default function Home() {
  const [text, setText] = useState('')
  const [fileName, setFileName] = useState('')
  const [isPlaying, setIsPlaying] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [progress, setProgress] = useState(0)
  const [voices, setVoices] = useState([])
  const [selectedVoice, setSelectedVoice] = useState(null)
  const [rate, setRate] = useState(1)
  const [pitch, setPitch] = useState(1)
  const [dragOver, setDragOver] = useState(false)
  const [wordCount, setWordCount] = useState(0)
  const [currentWord, setCurrentWord] = useState('')
  const [chunks, setChunks] = useState([])
  const [currentChunk, setCurrentChunk] = useState(0)
  const [supported, setSupported] = useState(true)

  const utteranceRef = useRef(null)
  const fileInputRef = useRef(null)
  const chunksRef = useRef([])
  const currentChunkRef = useRef(0)
  const isPlayingRef = useRef(false)

  useEffect(() => {
    if (!window.speechSynthesis) {
      setSupported(false)
      return
    }
    const loadVoices = () => {
      const v = window.speechSynthesis.getVoices()
      if (v.length > 0) {
        setVoices(v)
        const english = v.find(v => v.lang.startsWith('en')) || v[0]
        setSelectedVoice(english)
      }
    }
    loadVoices()
    window.speechSynthesis.onvoiceschanged = loadVoices
    return () => { window.speechSynthesis.cancel() }
  }, [])

  const splitIntoChunks = (text, size = 200) => {
    const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [text]
    const result = []
    let current = ''
    for (const s of sentences) {
      if ((current + s).length > size && current) {
        result.push(current.trim())
        current = s
      } else {
        current += s
      }
    }
    if (current.trim()) result.push(current.trim())
    return result
  }

  const speakChunk = useCallback((chunkIndex, allChunks) => {
    if (chunkIndex >= allChunks.length) {
      setIsPlaying(false)
      setIsPaused(false)
      isPlayingRef.current = false
      setProgress(100)
      setCurrentWord('')
      setCurrentChunk(0)
      return
    }

    const utter = new SpeechSynthesisUtterance(allChunks[chunkIndex])
    utter.rate = rate
    utter.pitch = pitch
    if (selectedVoice) utter.voice = selectedVoice

    utter.onboundary = (e) => {
      if (e.name === 'word') {
        const word = allChunks[chunkIndex].substring(e.charIndex, e.charIndex + e.charLength)
        setCurrentWord(word)
      }
    }

    utter.onend = () => {
      const next = chunkIndex + 1
      currentChunkRef.current = next
      setCurrentChunk(next)
      setProgress(Math.round((next / allChunks.length) * 100))
      if (isPlayingRef.current) {
        speakChunk(next, allChunks)
      }
    }

    utter.onerror = () => {
      setIsPlaying(false)
      isPlayingRef.current = false
    }

    utteranceRef.current = utter
    window.speechSynthesis.speak(utter)
  }, [rate, pitch, selectedVoice])

  const handlePlay = () => {
    if (!text || !supported) return
    const plain = stripMarkdown(text)
    const c = splitIntoChunks(plain)
    chunksRef.current = c
    setChunks(c)
    currentChunkRef.current = 0
    setCurrentChunk(0)
    setProgress(0)
    isPlayingRef.current = true
    setIsPlaying(true)
    setIsPaused(false)
    window.speechSynthesis.cancel()
    speakChunk(0, c)
  }

  const handlePause = () => {
    if (isPlaying && !isPaused) {
      window.speechSynthesis.pause()
      setIsPaused(true)
      isPlayingRef.current = false
    }
  }

  const handleResume = () => {
    if (isPaused) {
      isPlayingRef.current = true
      setIsPaused(false)
      window.speechSynthesis.resume()
      // Resume from current chunk if synthesis is done
      if (!window.speechSynthesis.speaking) {
        speakChunk(currentChunkRef.current, chunksRef.current)
      }
    }
  }

  const handleStop = () => {
    window.speechSynthesis.cancel()
    setIsPlaying(false)
    setIsPaused(false)
    isPlayingRef.current = false
    setProgress(0)
    setCurrentWord('')
    setCurrentChunk(0)
  }

  const readFile = (file) => {
    if (!file) return
    if (!file.name.match(/\.(md|txt|markdown)$/i)) {
      alert('Please upload a .md or .txt file')
      return
    }
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target.result
      setText(content)
      setWordCount(content.split(/\s+/).filter(Boolean).length)
      handleStop()
    }
    reader.readAsText(file)
  }

  const handleFileInput = (e) => readFile(e.target.files[0])

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    readFile(e.dataTransfer.files[0])
  }

  const estimateTime = () => {
    const wpm = 150 * rate
    const mins = Math.ceil(wordCount / wpm)
    return mins < 1 ? '<1 min' : `~${mins} min`
  }

  return (
    <>
      <Head>
        <title>VoiceDoc — Text to Audio</title>
        <meta name="description" content="Convert markdown and text files to audio" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Mono:wght@300;400;500&display=swap" rel="stylesheet" />
      </Head>

      <div className="root">
        <div className="noise" />

        <header>
          <div className="logo">
            <span className="logo-mark">◈</span>
            <span className="logo-text">VoiceDoc</span>
          </div>
          <p className="tagline">Markdown & text to speech, in your browser</p>
        </header>

        <main>
          {!supported && (
            <div className="unsupported">
              ⚠ Your browser doesn't support the Web Speech API. Try Chrome or Edge.
            </div>
          )}

          {/* Upload Zone */}
          <section
            className={`upload-zone ${dragOver ? 'drag-over' : ''} ${fileName ? 'has-file' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input ref={fileInputRef} type="file" accept=".md,.txt,.markdown" onChange={handleFileInput} hidden />
            {fileName ? (
              <div className="file-info">
                <span className="file-icon">📄</span>
                <div>
                  <div className="file-name">{fileName}</div>
                  <div className="file-meta">{wordCount.toLocaleString()} words · {estimateTime()} to read</div>
                </div>
                <button className="change-btn" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click() }}>Change</button>
              </div>
            ) : (
              <div className="upload-prompt">
                <div className="upload-icon">⬆</div>
                <div className="upload-text">Drop your .md or .txt file here</div>
                <div className="upload-sub">or click to browse</div>
              </div>
            )}
          </section>

          {/* Text area fallback */}
          <section className="text-section">
            <label className="section-label">or paste text directly</label>
            <textarea
              className="text-input"
              value={text}
              onChange={(e) => {
                setText(e.target.value)
                setWordCount(e.target.value.split(/\s+/).filter(Boolean).length)
                if (!fileName) setFileName('')
              }}
              placeholder="Paste markdown or plain text here..."
              rows={8}
            />
          </section>

          {/* Controls */}
          <section className="controls-section">
            <div className="control-group">
              <label className="control-label">Voice</label>
              <select
                className="control-select"
                value={selectedVoice?.name || ''}
                onChange={(e) => setSelectedVoice(voices.find(v => v.name === e.target.value))}
              >
                {voices.map(v => (
                  <option key={v.name} value={v.name}>{v.name} ({v.lang})</option>
                ))}
              </select>
            </div>

            <div className="control-group">
              <label className="control-label">Speed <span className="control-val">{rate}×</span></label>
              <input type="range" min="0.5" max="2" step="0.1" value={rate}
                onChange={(e) => setRate(parseFloat(e.target.value))} className="slider" />
            </div>

            <div className="control-group">
              <label className="control-label">Pitch <span className="control-val">{pitch}</span></label>
              <input type="range" min="0.5" max="2" step="0.1" value={pitch}
                onChange={(e) => setPitch(parseFloat(e.target.value))} className="slider" />
            </div>
          </section>

          {/* Player */}
          <section className="player">
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <div className="progress-labels">
              <span>{progress}%</span>
              {currentWord && <span className="current-word">"{currentWord}"</span>}
              {chunks.length > 0 && <span>{currentChunk}/{chunks.length} segments</span>}
            </div>

            <div className="player-buttons">
              {!isPlaying && !isPaused && (
                <button className="btn btn-primary" onClick={handlePlay} disabled={!text || !supported}>
                  <span>▶</span> Play
                </button>
              )}
              {isPlaying && !isPaused && (
                <button className="btn btn-secondary" onClick={handlePause}>
                  <span>⏸</span> Pause
                </button>
              )}
              {isPaused && (
                <button className="btn btn-primary" onClick={handleResume}>
                  <span>▶</span> Resume
                </button>
              )}
              {(isPlaying || isPaused) && (
                <button className="btn btn-ghost" onClick={handleStop}>
                  <span>⏹</span> Stop
                </button>
              )}
            </div>
          </section>
        </main>

        <footer>
          <p>Powered by the Web Speech API · Runs entirely in your browser · No data sent to servers</p>
        </footer>
      </div>

      <style jsx global>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          background: #0d0d0d;
          color: #e8e2d9;
          font-family: 'DM Mono', monospace;
          min-height: 100vh;
        }
      `}</style>

      <style jsx>{`
        .root {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 40px 20px 80px;
          position: relative;
          overflow: hidden;
        }

        .noise {
          position: fixed; inset: 0; pointer-events: none; z-index: 0;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E");
          opacity: 0.4;
        }

        header {
          position: relative; z-index: 1;
          text-align: center;
          margin-bottom: 48px;
        }

        .logo {
          display: flex; align-items: center; gap: 12px;
          justify-content: center;
          margin-bottom: 8px;
        }

        .logo-mark {
          font-size: 28px;
          color: #c8b97a;
          animation: spin 8s linear infinite;
        }

        @keyframes spin { to { transform: rotate(360deg); } }

        .logo-text {
          font-family: 'DM Serif Display', serif;
          font-size: 38px;
          letter-spacing: -1px;
          color: #e8e2d9;
        }

        .tagline {
          font-size: 12px;
          color: #6b6560;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        main {
          position: relative; z-index: 1;
          width: 100%; max-width: 680px;
          display: flex; flex-direction: column; gap: 20px;
        }

        .unsupported {
          background: #2a1a1a; border: 1px solid #5a2020;
          color: #ff8080; padding: 12px 16px; border-radius: 8px;
          font-size: 13px;
        }

        .upload-zone {
          border: 1.5px dashed #2e2b27;
          border-radius: 12px;
          padding: 32px;
          cursor: pointer;
          transition: all 0.2s;
          background: rgba(255,255,255,0.02);
        }

        .upload-zone:hover, .upload-zone.drag-over {
          border-color: #c8b97a;
          background: rgba(200,185,122,0.04);
        }

        .upload-zone.has-file {
          border-style: solid;
          border-color: #3a3530;
        }

        .upload-prompt { text-align: center; }
        .upload-icon { font-size: 32px; margin-bottom: 12px; }
        .upload-text { font-size: 15px; color: #a09890; margin-bottom: 4px; }
        .upload-sub { font-size: 12px; color: #4a4540; }

        .file-info {
          display: flex; align-items: center; gap: 16px;
        }
        .file-icon { font-size: 28px; }
        .file-name { font-size: 14px; color: #e8e2d9; margin-bottom: 4px; }
        .file-meta { font-size: 12px; color: #6b6560; }
        .change-btn {
          margin-left: auto;
          background: none; border: 1px solid #3a3530;
          color: #a09890; padding: 6px 14px; border-radius: 6px;
          cursor: pointer; font-family: inherit; font-size: 12px;
          transition: all 0.15s;
        }
        .change-btn:hover { border-color: #c8b97a; color: #c8b97a; }

        .text-section { display: flex; flex-direction: column; gap: 8px; }
        .section-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: #4a4540; }

        .text-input {
          width: 100%; background: rgba(255,255,255,0.02);
          border: 1.5px solid #2e2b27; border-radius: 10px;
          color: #c8c2b9; padding: 16px;
          font-family: 'DM Mono', monospace; font-size: 13px;
          line-height: 1.7; resize: vertical;
          transition: border-color 0.2s;
        }
        .text-input:focus { outline: none; border-color: #3a3530; }
        .text-input::placeholder { color: #3a3530; }

        .controls-section {
          display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px;
          background: rgba(255,255,255,0.02);
          border: 1px solid #2e2b27; border-radius: 12px;
          padding: 20px;
        }

        @media (max-width: 520px) {
          .controls-section { grid-template-columns: 1fr; }
        }

        .control-group { display: flex; flex-direction: column; gap: 8px; }
        .control-label {
          font-size: 11px; text-transform: uppercase;
          letter-spacing: 0.1em; color: #6b6560;
          display: flex; justify-content: space-between;
        }
        .control-val { color: #c8b97a; }

        .control-select {
          background: #1a1915; border: 1px solid #3a3530;
          color: #c8c2b9; padding: 8px 10px; border-radius: 6px;
          font-family: inherit; font-size: 12px; cursor: pointer;
        }
        .control-select:focus { outline: none; border-color: #c8b97a; }

        .slider {
          -webkit-appearance: none; appearance: none;
          width: 100%; height: 3px;
          background: #2e2b27; border-radius: 2px; cursor: pointer;
        }
        .slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 14px; height: 14px; border-radius: 50%;
          background: #c8b97a; cursor: pointer;
        }

        .player {
          background: rgba(255,255,255,0.02);
          border: 1px solid #2e2b27; border-radius: 12px;
          padding: 24px; display: flex; flex-direction: column; gap: 16px;
        }

        .progress-bar {
          height: 3px; background: #2e2b27; border-radius: 2px; overflow: hidden;
        }
        .progress-fill {
          height: 100%; background: linear-gradient(90deg, #c8b97a, #e8d898);
          border-radius: 2px; transition: width 0.3s ease;
        }

        .progress-labels {
          display: flex; justify-content: space-between; align-items: center;
          font-size: 11px; color: #4a4540;
        }
        .current-word {
          color: #c8b97a; font-style: italic; max-width: 200px;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }

        .player-buttons { display: flex; gap: 10px; }

        .btn {
          display: flex; align-items: center; gap: 8px;
          padding: 12px 28px; border-radius: 8px; border: none;
          font-family: 'DM Mono', monospace; font-size: 13px;
          cursor: pointer; transition: all 0.15s; letter-spacing: 0.05em;
        }
        .btn:disabled { opacity: 0.3; cursor: not-allowed; }

        .btn-primary {
          background: #c8b97a; color: #0d0d0d; font-weight: 500;
        }
        .btn-primary:hover:not(:disabled) { background: #d8c98a; transform: translateY(-1px); }

        .btn-secondary {
          background: #2e2b27; color: #c8c2b9; border: 1px solid #3a3530;
        }
        .btn-secondary:hover { background: #3a3530; }

        .btn-ghost {
          background: none; color: #6b6560; border: 1px solid #2e2b27;
        }
        .btn-ghost:hover { border-color: #5a2020; color: #ff8080; }

        footer {
          position: relative; z-index: 1;
          margin-top: 48px; text-align: center;
          font-size: 11px; color: #3a3530;
          letter-spacing: 0.05em;
        }
      `}</style>
    </>
  )
}
