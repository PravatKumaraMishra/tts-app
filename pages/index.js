import Head from "next/head";
import { useState, useRef, useEffect, useCallback } from "react";

// ─── SEGMENT TYPE METADATA ────────────────────────────────────────────────────
const TYPES = {
  H1: { label: "h1", color: "#e8c96a", icon: "H1" },
  H2: { label: "h2", color: "#c8a85a", icon: "H2" },
  H3: { label: "h3", color: "#a8884a", icon: "H3" },
  H4: { label: "h4", color: "#887048", icon: "H4" },
  PARAGRAPH: { label: "paragraph", color: "#c8c2b9", icon: "¶" },
  BOLD: { label: "bold", color: "#e8e2d9", icon: "B" },
  CODE_BLOCK: { label: "code", color: "#7ab8c8", icon: "<>" },
  CODE_INLINE: { label: "code", color: "#7ab8c8", icon: "<>" },
  BLOCKQUOTE: { label: "quote", color: "#98a878", icon: "❝" },
  LIST_ITEM: { label: "list", color: "#c8b97a", icon: "•" },
  OL_ITEM: { label: "numbered", color: "#c8b97a", icon: "#" },
  TABLE_HEAD: { label: "table hdr", color: "#a878c8", icon: "▦" },
  TABLE_ROW: { label: "table row", color: "#8858a8", icon: "▦" },
  HR: { label: "divider", color: "#4a4540", icon: "—" },
  FOOTNOTE: { label: "footnote", color: "#6b6560", icon: "fn" },
};

// ─── MARKDOWN → SEMANTIC SEGMENTS ────────────────────────────────────────────
function parseMarkdown(raw) {
  const segments = [];
  const lines = raw.split("\n");
  let i = 0;

  const push = (type, text, extra = {}) => {
    const clean = text.replace(/\s+/g, " ").trim();
    if (clean) segments.push({ type, text: clean, ...extra });
  };

  function parseInlineParts(text) {
    const parts = [];
    const pat =
      /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|__(.+?)__|_(.+?)_|\*(.+?)\*|`(.+?)`|\[([^\]]+)\]\([^)]+\))/g;
    let last = 0,
      m;
    pat.lastIndex = 0;
    while ((m = pat.exec(text)) !== null) {
      if (m.index > last)
        parts.push({ text: text.slice(last, m.index), em: null });
      if (m[2]) parts.push({ text: m[2], em: "bolditalic" });
      else if (m[3]) parts.push({ text: m[3], em: "bold" });
      else if (m[4]) parts.push({ text: m[4], em: "bold" });
      else if (m[5]) parts.push({ text: m[5], em: "italic" });
      else if (m[6]) parts.push({ text: m[6], em: "italic" });
      else if (m[7]) parts.push({ text: m[7], em: "code" });
      else if (m[8]) parts.push({ text: m[8], em: null });
      last = m.index + m[0].length;
    }
    if (last < text.length) parts.push({ text: text.slice(last), em: null });
    return parts.filter((p) => p.text.trim());
  }

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    if (/^```/.test(line)) {
      const lang = line.replace(/^```/, "").trim();
      const codeLines = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) {
        codeLines.push(lines[i]);
        i++;
      }
      const codeText = codeLines.join(" ").replace(/\s+/g, " ").trim();
      if (codeText)
        push("CODE_BLOCK", lang ? `Code block in ${lang}.` : "Code block.", {
          codeContent: codeText,
        });
      i++;
      continue;
    }

    // Horizontal rule
    if (/^(---+|\*\*\*+|___+)\s*$/.test(line)) {
      push("HR", "Section break.");
      i++;
      continue;
    }

    // Headings
    const hMatch = line.match(/^(#{1,6})\s+(.+)/);
    if (hMatch) {
      const level = hMatch[1].length;
      const type = ["H1", "H2", "H3", "H4", "H4", "H4"][level - 1];
      const parts = parseInlineParts(hMatch[2]);
      push(type, parts.map((p) => p.text).join(" "));
      i++;
      continue;
    }

    // Blockquote
    if (/^>\s?/.test(line)) {
      const qLines = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        qLines.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      push(
        "BLOCKQUOTE",
        parseInlineParts(qLines.join(" "))
          .map((p) => p.text)
          .join(" "),
      );
      continue;
    }

    // Unordered list
    if (/^\s*[-*+]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*+]\s+/, ""));
        i++;
      }
      items.forEach((item, idx) => {
        push(
          "LIST_ITEM",
          parseInlineParts(item)
            .map((p) => p.text)
            .join(" "),
          { index: idx + 1, total: items.length },
        );
      });
      continue;
    }

    // Ordered list
    if (/^\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        const m = lines[i].match(/^(\d+)\.\s+(.+)/);
        items.push({ num: parseInt(m[1]), text: m[2] });
        i++;
      }
      items.forEach((item) => {
        push(
          "OL_ITEM",
          parseInlineParts(item.text)
            .map((p) => p.text)
            .join(" "),
          { num: item.num },
        );
      });
      continue;
    }

    // Table
    if (/^\|.+\|/.test(line)) {
      const tLines = [];
      while (i < lines.length && /^\|/.test(lines[i])) {
        tLines.push(lines[i]);
        i++;
      }
      tLines.forEach((tl, ti) => {
        if (/^\|[-| :]+\|/.test(tl)) return;
        const cells = tl
          .split("|")
          .map((c) => c.trim())
          .filter(Boolean);
        push(ti === 0 ? "TABLE_HEAD" : "TABLE_ROW", cells.join(", "), {
          cells,
        });
      });
      continue;
    }

    // Footnote
    if (/^\[\^.+\]:/.test(line)) {
      push("FOOTNOTE", line.replace(/^\[\^.+\]:\s*/, ""));
      i++;
      continue;
    }

    // Blank line
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Paragraph — split by inline bold/code
    const paraLines = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^[#>`|\d]/.test(lines[i]) &&
      !/^\s*[-*+]\s/.test(lines[i]) &&
      !/^```/.test(lines[i]) &&
      !/^(---+|\*\*\*+|___+)\s*$/.test(lines[i])
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length) {
      const fullPara = paraLines.join(" ");
      const parts = parseInlineParts(fullPara);
      let buf = "";
      parts.forEach((part) => {
        if (part.em === "bold" || part.em === "bolditalic") {
          if (buf.trim()) {
            push("PARAGRAPH", buf);
            buf = "";
          }
          push("BOLD", part.text);
        } else if (part.em === "code") {
          if (buf.trim()) {
            push("PARAGRAPH", buf);
            buf = "";
          }
          push("CODE_INLINE", part.text);
        } else {
          buf += " " + part.text;
        }
      });
      if (buf.trim()) push("PARAGRAPH", buf);
    }
  }

  return segments;
}

// ─── SEGMENT → UTTERANCE PARAMS ──────────────────────────────────────────────
function getSpeechParams(seg, baseRate, basePitch) {
  switch (seg.type) {
    case "H1":
      return {
        text: seg.text,
        rate: baseRate * 0.7,
        pitch: basePitch * 1.25,
        volume: 1,
        pauseBefore: 950,
        pauseAfter: 650,
      };
    case "H2":
      return {
        text: seg.text,
        rate: baseRate * 0.76,
        pitch: basePitch * 1.16,
        volume: 1,
        pauseBefore: 700,
        pauseAfter: 500,
      };
    case "H3":
      return {
        text: seg.text,
        rate: baseRate * 0.83,
        pitch: basePitch * 1.09,
        volume: 1,
        pauseBefore: 500,
        pauseAfter: 320,
      };
    case "H4":
      return {
        text: seg.text,
        rate: baseRate * 0.88,
        pitch: basePitch * 1.04,
        volume: 1,
        pauseBefore: 350,
        pauseAfter: 220,
      };
    case "PARAGRAPH":
      return {
        text: seg.text,
        rate: baseRate,
        pitch: basePitch,
        volume: 1,
        pauseBefore: 0,
        pauseAfter: 200,
      };
    case "BOLD":
      return {
        text: seg.text,
        rate: baseRate * 0.91,
        pitch: basePitch * 1.07,
        volume: 1,
        pauseBefore: 90,
        pauseAfter: 90,
      };
    case "CODE_BLOCK":
      return {
        text: seg.text,
        rate: baseRate * 0.8,
        pitch: basePitch * 0.86,
        volume: 0.88,
        pauseBefore: 420,
        pauseAfter: 420,
      };
    case "CODE_INLINE":
      return {
        text: seg.text,
        rate: baseRate * 0.87,
        pitch: basePitch * 0.9,
        volume: 0.95,
        pauseBefore: 65,
        pauseAfter: 65,
      };
    case "BLOCKQUOTE":
      return {
        text: seg.text,
        rate: baseRate * 0.86,
        pitch: basePitch * 0.91,
        volume: 0.85,
        pauseBefore: 380,
        pauseAfter: 380,
      };
    case "LIST_ITEM":
      return {
        text: seg.text,
        rate: baseRate * 0.97,
        pitch: basePitch,
        volume: 1,
        pauseBefore: 130,
        pauseAfter: 90,
      };
    case "OL_ITEM":
      return {
        text: `${seg.num}. ${seg.text}`,
        rate: baseRate * 0.97,
        pitch: basePitch,
        volume: 1,
        pauseBefore: 130,
        pauseAfter: 90,
      };
    case "TABLE_HEAD":
      return {
        text: `Table headers: ${seg.text}`,
        rate: baseRate * 0.84,
        pitch: basePitch * 1.06,
        volume: 1,
        pauseBefore: 420,
        pauseAfter: 220,
      };
    case "TABLE_ROW":
      return {
        text: seg.text,
        rate: baseRate * 0.9,
        pitch: basePitch * 0.97,
        volume: 1,
        pauseBefore: 110,
        pauseAfter: 110,
      };
    case "HR":
      return {
        text: "Section break.",
        rate: baseRate * 0.68,
        pitch: basePitch * 0.78,
        volume: 0.65,
        pauseBefore: 750,
        pauseAfter: 750,
      };
    case "FOOTNOTE":
      return {
        text: `Footnote: ${seg.text}`,
        rate: baseRate * 0.84,
        pitch: basePitch * 0.84,
        volume: 0.72,
        pauseBefore: 320,
        pauseAfter: 160,
      };
    default:
      return {
        text: seg.text,
        rate: baseRate,
        pitch: basePitch,
        volume: 1,
        pauseBefore: 0,
        pauseAfter: 180,
      };
  }
}

// ─── COMPONENT ────────────────────────────────────────────────────────────────
export default function Home() {
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState("");
  const [segments, setSegments] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(-1);
  const [progress, setProgress] = useState(0);
  const [voices, setVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(null);
  const [rate, setRate] = useState(1);
  const [pitch, setPitch] = useState(1);
  const [dragOver, setDragOver] = useState(false);
  const [wordCount, setWordCount] = useState(0);
  const [supported, setSupported] = useState(true);
  const [activeTab, setActiveTab] = useState("upload");

  const fileInputRef = useRef(null);
  const isPlayingRef = useRef(false);
  const currentIdxRef = useRef(-1);
  const segmentsRef = useRef([]);
  const pauseTimerRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      setSupported(false);
      return;
    }
    const load = () => {
      const v = window.speechSynthesis.getVoices();
      if (v.length) {
        setVoices(v);
        setSelectedVoice(
          v.find(
            (x) =>
              x.lang.startsWith("en") &&
              /natural|enhanced|premium/i.test(x.name),
          ) ||
            v.find((x) => x.lang.startsWith("en-US")) ||
            v.find((x) => x.lang.startsWith("en")) ||
            v[0],
        );
      }
    };
    load();
    window.speechSynthesis.onvoiceschanged = load;
    return () => {
      window.speechSynthesis.cancel();
      clearTimeout(pauseTimerRef.current);
    };
  }, []);

  const speakSegment = useCallback(
    (idx, segs) => {
      if (idx >= segs.length || !isPlayingRef.current) {
        setIsPlaying(false);
        setIsPaused(false);
        isPlayingRef.current = false;
        setProgress(100);
        setCurrentIdx(-1);
        return;
      }
      const params = getSpeechParams(segs[idx], rate, pitch);

      const doSpeak = () => {
        if (!isPlayingRef.current) return;
        const utt = new SpeechSynthesisUtterance(params.text);
        utt.rate = Math.min(Math.max(params.rate, 0.1), 10);
        utt.pitch = Math.min(Math.max(params.pitch, 0), 2);
        utt.volume = params.volume;
        if (selectedVoice) utt.voice = selectedVoice;
        utt.onend = () => {
          if (!isPlayingRef.current) return;
          const next = idx + 1;
          currentIdxRef.current = next;
          setCurrentIdx(next);
          setProgress(Math.round((next / segs.length) * 100));
          pauseTimerRef.current = setTimeout(
            () => speakSegment(next, segs),
            params.pauseAfter,
          );
        };
        utt.onerror = (e) => {
          if (e.error === "interrupted" || e.error === "canceled") return;
          setIsPlaying(false);
          isPlayingRef.current = false;
        };
        window.speechSynthesis.speak(utt);
      };
      params.pauseBefore > 0
        ? (pauseTimerRef.current = setTimeout(doSpeak, params.pauseBefore))
        : doSpeak();
    },
    [rate, pitch, selectedVoice],
  );

  const handlePlay = () => {
    if (!text || !supported) return;
    const segs = parseMarkdown(text);
    segmentsRef.current = segs;
    setSegments(segs);
    currentIdxRef.current = 0;
    setCurrentIdx(0);
    setProgress(0);
    isPlayingRef.current = true;
    setIsPlaying(true);
    setIsPaused(false);
    window.speechSynthesis.cancel();
    clearTimeout(pauseTimerRef.current);
    setActiveTab("preview");
    speakSegment(0, segs);
  };

  const handlePause = () => {
    clearTimeout(pauseTimerRef.current);
    window.speechSynthesis.pause();
    isPlayingRef.current = false;
    setIsPaused(true);
  };

  const handleResume = () => {
    isPlayingRef.current = true;
    setIsPaused(false);
    if (window.speechSynthesis.paused) window.speechSynthesis.resume();
    else {
      window.speechSynthesis.cancel();
      speakSegment(currentIdxRef.current, segmentsRef.current);
    }
  };

  const handleStop = () => {
    clearTimeout(pauseTimerRef.current);
    window.speechSynthesis.cancel();
    isPlayingRef.current = false;
    setIsPlaying(false);
    setIsPaused(false);
    setProgress(0);
    setCurrentIdx(-1);
  };

  const jumpTo = (idx) => {
    clearTimeout(pauseTimerRef.current);
    window.speechSynthesis.cancel();
    isPlayingRef.current = true;
    setIsPlaying(true);
    setIsPaused(false);
    currentIdxRef.current = idx;
    setCurrentIdx(idx);
    speakSegment(idx, segmentsRef.current);
  };

  const readFile = (file) => {
    if (!file) return;
    if (!file.name.match(/\.(md|txt|markdown|rst|text)$/i)) {
      alert("Please upload .md, .txt, or .markdown");
      return;
    }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target.result;
      setText(content);
      setWordCount(content.split(/\s+/).filter(Boolean).length);
      const segs = parseMarkdown(content);
      setSegments(segs);
      segmentsRef.current = segs;
      handleStop();
      setActiveTab("preview");
    };
    reader.readAsText(file);
  };

  const handleTextChange = (val) => {
    setText(val);
    setWordCount(val.split(/\s+/).filter(Boolean).length);
    const segs = parseMarkdown(val);
    setSegments(segs);
    segmentsRef.current = segs;
  };

  const estimateTime = () => {
    const wpm = 150 * rate;
    const mins = Math.ceil(wordCount / wpm);
    return mins < 1 ? "<1 min" : `~${mins} min`;
  };

  useEffect(() => {
    if (currentIdx >= 0 && listRef.current) {
      const el = listRef.current.querySelector(`[data-idx="${currentIdx}"]`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [currentIdx]);

  const ti = (type) => TYPES[type] || TYPES.PARAGRAPH;
  const curSeg =
    currentIdx >= 0 && currentIdx < segments.length
      ? segments[currentIdx]
      : null;

  return (
    <>
      <Head>
        <title>VoiceDoc — Semantic TTS</title>
        <meta name="description" content="Structure-aware markdown to speech" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,600;1,9..144,400&family=JetBrains+Mono:wght@300;400;500&display=swap"
          rel="stylesheet"
        />
      </Head>

      <div className="app">
        <div className="bg-grid" />
        <div className="bg-glow" />

        <header>
          <div className="brand">
            <svg width="34" height="34" viewBox="0 0 34 34" fill="none">
              <circle
                cx="17"
                cy="17"
                r="16"
                stroke="#c8b97a"
                strokeWidth="1.5"
              />
              <path
                d="M10 17 Q17 8 24 17 Q17 26 10 17Z"
                fill="#c8b97a"
                opacity="0.85"
              />
              <circle cx="17" cy="17" r="3.5" fill="#090910" />
              <circle cx="17" cy="17" r="1.5" fill="#c8b97a" />
            </svg>
            <span className="brand-name">VoiceDoc</span>
            <span className="brand-pill">Semantic</span>
          </div>
          <p className="brand-sub">
            Every markdown element has its own voice, pitch &amp; pause
          </p>
        </header>

        <div className="tabs-row">
          {[
            ["upload", "⬆", "Upload"],
            ["preview", "◈", "Segments"],
            ["settings", "⚙", "Settings"],
          ].map(([id, icon, label]) => (
            <button
              key={id}
              className={`tab ${activeTab === id ? "on" : ""}`}
              onClick={() => setActiveTab(id)}
            >
              {icon} {label}
              {id === "preview" && segments.length > 0 && (
                <span className="tab-count">{segments.length}</span>
              )}
            </button>
          ))}
        </div>

        <main className="main">
          {!supported && (
            <div className="banner">
              ⚠ Web Speech API unsupported. Use Chrome or Edge.
            </div>
          )}

          {activeTab === "upload" && (
            <div className="panel">
              <div
                className={`dropzone ${dragOver ? "drag" : ""} ${fileName ? "filled" : ""}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  readFile(e.dataTransfer.files[0]);
                }}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".md,.txt,.markdown,.rst"
                  onChange={(e) => readFile(e.target.files[0])}
                  hidden
                />
                {fileName ? (
                  <div className="file-row">
                    <span className="ficon">📄</span>
                    <div>
                      <div className="fname">{fileName}</div>
                      <div className="fmeta">
                        {wordCount.toLocaleString()} words · {segments.length}{" "}
                        segments · {estimateTime()}
                      </div>
                    </div>
                    <button
                      className="btn-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        fileInputRef.current?.click();
                      }}
                    >
                      Replace
                    </button>
                  </div>
                ) : (
                  <div className="drop-inner">
                    <svg
                      className="drop-svg"
                      width="48"
                      height="48"
                      viewBox="0 0 48 48"
                      fill="none"
                    >
                      <path
                        d="M24 10v20M16 18l8-8 8 8"
                        stroke="#c8b97a"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M10 36v4h28v-4"
                        stroke="#4a4540"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="drop-title">Drop your document</div>
                    <div className="drop-fmts">
                      .md · .txt · .markdown · .rst
                    </div>
                  </div>
                )}
              </div>

              <div className="divider">
                <span>or type / paste</span>
              </div>

              <textarea
                className="tarea"
                value={text}
                onChange={(e) => handleTextChange(e.target.value)}
                placeholder={
                  "# Document Title\n\n## Section Heading\n\nParagraphs are read normally.\n\n**Bold phrases** are emphasised slightly.\n\n> Blockquotes become quieter and slower.\n\n- List items get a small pause between them\n\n```js\ncode blocks are read in a lower robotic tone\n```"
                }
                rows={12}
              />
              {segments.length > 0 && (
                <button
                  className="btn-go"
                  onClick={() => setActiveTab("preview")}
                >
                  Preview {segments.length} parsed segments →
                </button>
              )}
            </div>
          )}

          {activeTab === "preview" && (
            <div className="panel">
              {segments.length === 0 ? (
                <div className="empty">
                  <div className="empty-icon">◈</div>
                  <p>Upload or paste a document first</p>
                </div>
              ) : (
                <div className="seg-list" ref={listRef}>
                  {segments.map((seg, idx) => {
                    const info = ti(seg.type);
                    const active = currentIdx === idx;
                    const past = currentIdx > idx && currentIdx >= 0;
                    return (
                      <div
                        key={idx}
                        data-idx={idx}
                        className={`seg ${active ? "active" : ""} ${past ? "past" : ""} ${isPlaying || isPaused ? "clickable" : ""}`}
                        onClick={() => (isPlaying || isPaused) && jumpTo(idx)}
                        title={
                          isPlaying || isPaused ? "Click to jump here" : ""
                        }
                      >
                        <span
                          className="stag"
                          style={{
                            color: info.color,
                            borderColor: info.color + "44",
                          }}
                        >
                          {info.icon}
                        </span>
                        <div className="sbody">
                          <div
                            className="slabel"
                            style={{ color: info.color + "bb" }}
                          >
                            {info.label}
                          </div>
                          <div
                            className={`stext stype-${seg.type.toLowerCase().replace(/_/g, "-")}`}
                          >
                            {seg.text}
                          </div>
                        </div>
                        {active && <span className="sdot" />}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === "settings" && (
            <div className="panel">
              <div className="settings">
                <div className="sfield">
                  <label className="slbl">Voice</label>
                  <select
                    className="sselect"
                    value={selectedVoice?.name || ""}
                    onChange={(e) =>
                      setSelectedVoice(
                        voices.find((v) => v.name === e.target.value),
                      )
                    }
                  >
                    {voices.map((v) => (
                      <option key={v.name} value={v.name}>
                        {v.name} ({v.lang})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sfield">
                  <label className="slbl">
                    Base Speed <b>{rate}×</b>
                  </label>
                  <input
                    type="range"
                    min="0.5"
                    max="2"
                    step="0.05"
                    value={rate}
                    onChange={(e) => setRate(parseFloat(e.target.value))}
                    className="range"
                  />
                  <div className="rlabels">
                    <span>0.5×</span>
                    <span>2×</span>
                  </div>
                </div>
                <div className="sfield">
                  <label className="slbl">
                    Base Pitch <b>{pitch}</b>
                  </label>
                  <input
                    type="range"
                    min="0.5"
                    max="2"
                    step="0.05"
                    value={pitch}
                    onChange={(e) => setPitch(parseFloat(e.target.value))}
                    className="range"
                  />
                  <div className="rlabels">
                    <span>Low</span>
                    <span>High</span>
                  </div>
                </div>
              </div>

              <div className="legend">
                <div className="legend-title">
                  Element voice profiles (relative to your base settings)
                </div>
                {[
                  [
                    "H1",
                    "0.70× speed · 1.25× pitch · 950ms pause before, 650ms after",
                  ],
                  [
                    "H2",
                    "0.76× speed · 1.16× pitch · 700ms pause before, 500ms after",
                  ],
                  ["H3", "0.83× speed · 1.09× pitch · 500ms pause before"],
                  ["H4", "0.88× speed · 1.04× pitch · 350ms pause before"],
                  ["PARAGRAPH", "Normal speed and pitch · 200ms pause after"],
                  [
                    "BOLD",
                    "0.91× speed · 1.07× pitch · 90ms extra pause each side",
                  ],
                  [
                    "CODE_BLOCK",
                    "0.80× speed · 0.86× pitch · 88% volume · 420ms pause",
                  ],
                  ["CODE_INLINE", "0.87× speed · 0.90× pitch · 95% volume"],
                  [
                    "BLOCKQUOTE",
                    "0.86× speed · 0.91× pitch · 85% volume · 380ms pause",
                  ],
                  ["LIST_ITEM", "Normal speed · 130ms pause before each item"],
                  ["OL_ITEM", "Number spoken aloud · 130ms pause before each"],
                  [
                    "HR",
                    '"Section break." · 0.68× speed · 0.78× pitch · 750ms pause',
                  ],
                ].map(([t, d]) => {
                  const info = ti(t);
                  return (
                    <div key={t} className="lrow">
                      <span
                        className="ltag"
                        style={{
                          color: info.color,
                          borderColor: info.color + "44",
                        }}
                      >
                        {info.icon}
                      </span>
                      <span className="ldesc">{d}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </main>

        {/* ── PLAYER BAR ── */}
        <div className="pbar">
          <div className="pinner">
            <div className="pinfo">
              {curSeg ? (
                <>
                  <span
                    className="ptag"
                    style={{ color: ti(curSeg.type).color }}
                  >
                    {ti(curSeg.type).icon}
                  </span>
                  <span className="ptext">
                    {curSeg.text.slice(0, 72)}
                    {curSeg.text.length > 72 ? "…" : ""}
                  </span>
                </>
              ) : (
                <span className="pidle">
                  {segments.length > 0
                    ? `${segments.length} segments · ${estimateTime()}`
                    : "Load a document to begin"}
                </span>
              )}
            </div>
            <div className="pprog">
              <div className="ptrack">
                <div className="pfill" style={{ width: `${progress}%` }} />
              </div>
              <span className="ppct">{progress}%</span>
            </div>
            <div className="pbtns">
              {!isPlaying && !isPaused && (
                <button
                  className="pbtn play"
                  onClick={handlePlay}
                  disabled={!text || !supported}
                >
                  <svg viewBox="0 0 24 24">
                    <polygon points="6,3 20,12 6,21" fill="currentColor" />
                  </svg>
                </button>
              )}
              {isPlaying && !isPaused && (
                <button className="pbtn pause" onClick={handlePause}>
                  <svg viewBox="0 0 24 24">
                    <rect
                      x="5"
                      y="3"
                      width="5"
                      height="18"
                      fill="currentColor"
                    />
                    <rect
                      x="14"
                      y="3"
                      width="5"
                      height="18"
                      fill="currentColor"
                    />
                  </svg>
                </button>
              )}
              {isPaused && (
                <button className="pbtn play" onClick={handleResume}>
                  <svg viewBox="0 0 24 24">
                    <polygon points="6,3 20,12 6,21" fill="currentColor" />
                  </svg>
                </button>
              )}
              {(isPlaying || isPaused) && (
                <button className="pbtn stop" onClick={handleStop}>
                  <svg viewBox="0 0 24 24">
                    <rect
                      x="4"
                      y="4"
                      width="16"
                      height="16"
                      fill="currentColor"
                    />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        *,
        *::before,
        *::after {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        body {
          background: #090910;
          color: #d8d2c9;
          font-family: "JetBrains Mono", monospace;
          min-height: 100vh;
          overflow-x: hidden;
        }
        ::-webkit-scrollbar {
          width: 4px;
        }
        ::-webkit-scrollbar-track {
          background: #090910;
        }
        ::-webkit-scrollbar-thumb {
          background: #2e2b27;
          border-radius: 2px;
        }
      `}</style>

      <style jsx>{`
        .app {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          padding-bottom: 96px;
          position: relative;
        }
        .bg-grid {
          position: fixed;
          inset: 0;
          pointer-events: none;
          background-image:
            linear-gradient(rgba(200, 185, 122, 0.025) 1px, transparent 1px),
            linear-gradient(
              90deg,
              rgba(200, 185, 122, 0.025) 1px,
              transparent 1px
            );
          background-size: 48px 48px;
          z-index: 0;
        }
        .bg-glow {
          position: fixed;
          top: -200px;
          left: 50%;
          transform: translateX(-50%);
          width: 700px;
          height: 500px;
          background: radial-gradient(
            ellipse,
            rgba(200, 185, 122, 0.05) 0%,
            transparent 70%
          );
          pointer-events: none;
          z-index: 0;
        }

        header {
          position: relative;
          z-index: 1;
          text-align: center;
          padding: 48px 20px 20px;
        }
        .brand {
          display: flex;
          align-items: center;
          gap: 12px;
          justify-content: center;
          margin-bottom: 8px;
        }
        .brand-name {
          font-family: "Fraunces", serif;
          font-size: 38px;
          font-weight: 600;
          letter-spacing: -2px;
          color: #e8e2d9;
        }
        .brand-pill {
          font-size: 10px;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          color: #c8b97a;
          border: 1px solid #c8b97a44;
          padding: 3px 9px;
          border-radius: 20px;
          margin-top: 2px;
        }
        .brand-sub {
          font-size: 11px;
          color: #4a4540;
          letter-spacing: 0.04em;
        }

        .tabs-row {
          position: relative;
          z-index: 1;
          display: flex;
          gap: 3px;
          justify-content: center;
          padding: 20px 20px 24px;
        }
        .tab {
          background: none;
          border: 1px solid #2e2b27;
          color: #6b6560;
          padding: 8px 18px;
          border-radius: 6px;
          font-family: "JetBrains Mono", monospace;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.15s;
          letter-spacing: 0.04em;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .tab:hover {
          color: #a09890;
          border-color: #3a3530;
        }
        .tab.on {
          background: #c8b97a;
          color: #090910;
          border-color: #c8b97a;
          font-weight: 500;
        }
        .tab-count {
          background: rgba(0, 0, 0, 0.25);
          color: inherit;
          font-size: 10px;
          padding: 1px 5px;
          border-radius: 10px;
        }

        .main {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 720px;
          margin: 0 auto;
          padding: 0 20px;
          flex: 1;
        }
        .panel {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .banner {
          background: #2a1a1a;
          border: 1px solid #5a2020;
          color: #ff8080;
          padding: 12px 16px;
          border-radius: 8px;
          font-size: 12px;
          margin-bottom: 8px;
        }

        .dropzone {
          border: 1.5px dashed #2e2b27;
          border-radius: 14px;
          padding: 40px 32px;
          cursor: pointer;
          transition: all 0.2s;
          background: rgba(255, 255, 255, 0.015);
        }
        .dropzone:hover,
        .dropzone.drag {
          border-color: #c8b97a;
          background: rgba(200, 185, 122, 0.04);
        }
        .dropzone.filled {
          border-style: solid;
          border-color: #3a3530;
        }
        .drop-inner {
          text-align: center;
        }
        .drop-svg {
          margin: 0 auto 16px;
          display: block;
        }
        .drop-title {
          font-family: "Fraunces", serif;
          font-size: 16px;
          color: #a09890;
          margin-bottom: 6px;
        }
        .drop-fmts {
          font-size: 11px;
          color: #4a4540;
          letter-spacing: 0.1em;
        }
        .file-row {
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .ficon {
          font-size: 32px;
        }
        .fname {
          font-size: 14px;
          color: #e8e2d9;
          margin-bottom: 3px;
        }
        .fmeta {
          font-size: 11px;
          color: #6b6560;
        }
        .btn-xs {
          margin-left: auto;
          background: none;
          border: 1px solid #3a3530;
          color: #a09890;
          padding: 6px 14px;
          border-radius: 6px;
          cursor: pointer;
          font-family: inherit;
          font-size: 11px;
          transition: all 0.15s;
        }
        .btn-xs:hover {
          border-color: #c8b97a;
          color: #c8b97a;
        }

        .divider {
          display: flex;
          align-items: center;
          gap: 12px;
          color: #3a3530;
          font-size: 11px;
          letter-spacing: 0.08em;
        }
        .divider::before,
        .divider::after {
          content: "";
          flex: 1;
          height: 1px;
          background: #2e2b27;
        }

        .tarea {
          width: 100%;
          background: rgba(255, 255, 255, 0.02);
          border: 1.5px solid #2e2b27;
          border-radius: 12px;
          color: #c8c2b9;
          padding: 18px;
          font-family: "JetBrains Mono", monospace;
          font-size: 12px;
          line-height: 1.8;
          resize: vertical;
          transition: border-color 0.2s;
          white-space: pre-wrap;
        }
        .tarea:focus {
          outline: none;
          border-color: #3a3530;
        }
        .tarea::placeholder {
          color: #2a2820;
          font-size: 11px;
        }

        .btn-go {
          align-self: flex-end;
          background: none;
          border: 1px solid #c8b97a44;
          color: #c8b97a;
          padding: 10px 20px;
          border-radius: 8px;
          cursor: pointer;
          font-family: inherit;
          font-size: 12px;
          transition: all 0.15s;
        }
        .btn-go:hover {
          background: #c8b97a11;
          border-color: #c8b97a;
        }

        .seg-list {
          display: flex;
          flex-direction: column;
          gap: 3px;
          max-height: calc(100vh - 280px);
          overflow-y: auto;
          padding-right: 4px;
        }
        .seg {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 9px 13px;
          border-radius: 8px;
          border: 1px solid transparent;
          transition: all 0.12s;
          position: relative;
        }
        .seg.active {
          background: rgba(200, 185, 122, 0.07);
          border-color: rgba(200, 185, 122, 0.22);
        }
        .seg.past {
          opacity: 0.38;
        }
        .seg.clickable {
          cursor: pointer;
        }
        .seg.clickable:hover {
          background: rgba(255, 255, 255, 0.03);
          border-color: #3a3530;
        }

        .stag {
          font-size: 10px;
          font-weight: 500;
          letter-spacing: 0.04em;
          border: 1px solid;
          border-radius: 4px;
          padding: 2px 5px;
          white-space: nowrap;
          min-width: 24px;
          text-align: center;
          margin-top: 1px;
          flex-shrink: 0;
        }
        .sbody {
          flex: 1;
          min-width: 0;
        }
        .slabel {
          font-size: 9px;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          margin-bottom: 2px;
        }
        .stext {
          font-size: 13px;
          line-height: 1.65;
          color: #b8b2a9;
          word-break: break-word;
        }
        .stype-h1 {
          font-family: "Fraunces", serif;
          font-size: 18px;
          font-weight: 600;
          color: #e8e2d9;
        }
        .stype-h2 {
          font-family: "Fraunces", serif;
          font-size: 15px;
          font-weight: 600;
          color: #ddd8cf;
        }
        .stype-h3 {
          font-family: "Fraunces", serif;
          font-size: 14px;
          color: #ccc8bf;
        }
        .stype-bold {
          font-weight: 500;
          color: #ddd8cf;
        }
        .stype-blockquote {
          font-style: italic;
          opacity: 0.8;
        }
        .stype-code-block,
        .stype-code-inline {
          font-size: 11px;
          color: #7ab8c8;
        }
        .stype-hr {
          font-size: 11px;
          letter-spacing: 0.2em;
          opacity: 0.4;
        }

        .sdot {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #c8b97a;
          animation: pulse 1s ease-in-out infinite;
        }
        @keyframes pulse {
          0%,
          100% {
            opacity: 1;
            transform: translateY(-50%) scale(1);
          }
          50% {
            opacity: 0.35;
            transform: translateY(-50%) scale(0.65);
          }
        }

        .empty {
          text-align: center;
          padding: 60px 20px;
          color: #4a4540;
        }
        .empty-icon {
          font-size: 48px;
          margin-bottom: 16px;
          opacity: 0.25;
        }

        .settings {
          display: flex;
          flex-direction: column;
          gap: 20px;
          margin-bottom: 28px;
        }
        .sfield {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .slbl {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: #6b6560;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .slbl b {
          font-style: normal;
          color: #c8b97a;
          font-size: 13px;
          font-weight: 500;
        }
        .sselect {
          background: #0f0f18;
          border: 1px solid #3a3530;
          color: #c8c2b9;
          padding: 10px 12px;
          border-radius: 8px;
          font-family: inherit;
          font-size: 12px;
          cursor: pointer;
        }
        .sselect:focus {
          outline: none;
          border-color: #c8b97a;
        }
        .range {
          -webkit-appearance: none;
          appearance: none;
          width: 100%;
          height: 3px;
          background: #2e2b27;
          border-radius: 2px;
          cursor: pointer;
        }
        .range::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #c8b97a;
          cursor: pointer;
          box-shadow: 0 0 0 4px rgba(200, 185, 122, 0.15);
        }
        .rlabels {
          display: flex;
          justify-content: space-between;
          font-size: 10px;
          color: #4a4540;
        }

        .legend {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid #2e2b27;
          border-radius: 12px;
          padding: 20px;
        }
        .legend-title {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: #6b6560;
          margin-bottom: 14px;
        }
        .lrow {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          margin-bottom: 9px;
        }
        .ltag {
          font-size: 10px;
          border: 1px solid;
          border-radius: 4px;
          padding: 2px 5px;
          min-width: 24px;
          text-align: center;
          flex-shrink: 0;
          margin-top: 1px;
        }
        .ldesc {
          font-size: 11px;
          color: #6b6560;
          line-height: 1.5;
        }

        .pbar {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          background: rgba(9, 9, 16, 0.93);
          backdrop-filter: blur(14px);
          border-top: 1px solid #2e2b27;
          z-index: 100;
        }
        .pinner {
          max-width: 720px;
          margin: 0 auto;
          padding: 12px 20px;
          display: flex;
          align-items: center;
          gap: 14px;
          flex-wrap: wrap;
        }
        .pinfo {
          flex: 1;
          min-width: 0;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .ptag {
          font-size: 11px;
          border: 1px solid currentColor;
          border-radius: 3px;
          padding: 1px 5px;
          opacity: 0.8;
          flex-shrink: 0;
        }
        .ptext {
          font-size: 12px;
          color: #a09890;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .pidle {
          font-size: 12px;
          color: #4a4540;
        }
        .pprog {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
        }
        .ptrack {
          width: 130px;
          height: 3px;
          background: #2e2b27;
          border-radius: 2px;
          overflow: hidden;
        }
        .pfill {
          height: 100%;
          background: linear-gradient(90deg, #c8b97a, #e8d898);
          border-radius: 2px;
          transition: width 0.4s ease;
        }
        .ppct {
          font-size: 11px;
          color: #4a4540;
          width: 32px;
        }
        .pbtns {
          display: flex;
          gap: 8px;
          flex-shrink: 0;
        }
        .pbtn {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.15s;
        }
        .pbtn svg {
          width: 15px;
          height: 15px;
        }
        .pbtn:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }
        .pbtn.play {
          background: #c8b97a;
          color: #090910;
        }
        .pbtn.play:hover:not(:disabled) {
          background: #d8c98a;
          transform: scale(1.06);
        }
        .pbtn.pause {
          background: #2e2b27;
          color: #c8c2b9;
        }
        .pbtn.pause:hover {
          background: #3a3530;
        }
        .pbtn.stop {
          background: none;
          border: 1px solid #3a3530;
          color: #6b6560;
        }
        .pbtn.stop:hover {
          border-color: #5a2020;
          color: #ff8080;
        }

        @media (max-width: 520px) {
          .ptrack {
            width: 70px;
          }
          .ptext {
            display: none;
          }
          .brand-name {
            font-size: 30px;
          }
        }
      `}</style>
    </>
  );
}
