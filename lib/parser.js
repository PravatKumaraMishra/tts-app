// lib/parser.js — Markdown → semantic segments for TTS

export const SEGMENT_TYPES = {
  H1:          { label: 'H1',         color: '#e8c96a', cssClass: 'h1' },
  H2:          { label: 'H2',         color: '#c8a85a', cssClass: 'h2' },
  H3:          { label: 'H3',         color: '#a8884a', cssClass: 'h3' },
  H4:          { label: 'H4',         color: '#887048', cssClass: 'h4' },
  PARAGRAPH:   { label: '¶',          color: '#c8c2b9', cssClass: 'para' },
  BOLD:        { label: 'B',          color: '#e8e2d9', cssClass: 'bold' },
  CODE_BLOCK:  { label: '</>',        color: '#7ab8c8', cssClass: 'code' },
  CODE_INLINE: { label: '`',          color: '#7ab8c8', cssClass: 'code' },
  BLOCKQUOTE:  { label: '❝',          color: '#98a878', cssClass: 'quote' },
  LIST_ITEM:   { label: '•',          color: '#c8b97a', cssClass: 'list' },
  OL_ITEM:     { label: '#',          color: '#c8b97a', cssClass: 'list' },
  TABLE_HEAD:  { label: '▦',          color: '#a878c8', cssClass: 'table' },
  TABLE_ROW:   { label: '▦',          color: '#8858a8', cssClass: 'table' },
  HR:          { label: '—',          color: '#4a4540', cssClass: 'hr' },
}

function parseInline(text) {
  const parts = []
  const pat = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|__(.+?)__|_(.+?)_|\*(.+?)\*|`(.+?)`|\[([^\]]+)\]\([^)]+\))/g
  let last = 0, m
  pat.lastIndex = 0
  while ((m = pat.exec(text)) !== null) {
    if (m.index > last) parts.push({ text: text.slice(last, m.index), em: null })
    if (m[2])      parts.push({ text: m[2], em: 'bolditalic' })
    else if (m[3]) parts.push({ text: m[3], em: 'bold' })
    else if (m[4]) parts.push({ text: m[4], em: 'bold' })
    else if (m[5]) parts.push({ text: m[5], em: 'italic' })
    else if (m[6]) parts.push({ text: m[6], em: 'italic' })
    else if (m[7]) parts.push({ text: m[7], em: 'code' })
    else if (m[8]) parts.push({ text: m[8], em: null })
    last = m.index + m[0].length
  }
  if (last < text.length) parts.push({ text: text.slice(last), em: null })
  return parts.filter(p => p.text.trim())
}

export function parseMarkdown(raw) {
  const segments = []
  const lines = raw.split('\n')
  let i = 0

  const push = (type, text, extra = {}) => {
    const clean = text.replace(/\s+/g, ' ').trim()
    if (clean) segments.push({ type, text: clean, id: segments.length, ...extra })
  }

  while (i < lines.length) {
    const line = lines[i]

    // Fenced code block
    if (/^```/.test(line)) {
      const lang = line.replace(/^```/, '').trim()
      const code = []
      i++
      while (i < lines.length && !/^```/.test(lines[i])) { code.push(lines[i]); i++ }
      push('CODE_BLOCK', lang ? `Code block in ${lang}.` : 'Code block.', { code: code.join('\n') })
      i++; continue
    }

    // HR
    if (/^(---+|\*\*\*+|___+)\s*$/.test(line)) { push('HR', 'Section break.'); i++; continue }

    // Headings
    const hm = line.match(/^(#{1,6})\s+(.+)/)
    if (hm) {
      const t = ['H1','H2','H3','H4','H4','H4'][hm[1].length - 1]
      push(t, parseInline(hm[2]).map(p => p.text).join(' '))
      i++; continue
    }

    // Blockquote
    if (/^>\s?/.test(line)) {
      const ql = []
      while (i < lines.length && /^>\s?/.test(lines[i])) { ql.push(lines[i].replace(/^>\s?/, '')); i++ }
      push('BLOCKQUOTE', parseInline(ql.join(' ')).map(p => p.text).join(' '))
      continue
    }

    // Unordered list
    if (/^\s*[-*+]\s+/.test(line)) {
      const items = []
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*+]\s+/, '')); i++
      }
      items.forEach((item, idx) => push('LIST_ITEM', parseInline(item).map(p => p.text).join(' '), { index: idx + 1 }))
      continue
    }

    // Ordered list
    if (/^\d+\.\s+/.test(line)) {
      const items = []
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        const m = lines[i].match(/^(\d+)\.\s+(.+)/)
        items.push({ num: parseInt(m[1]), text: m[2] }); i++
      }
      items.forEach(it => push('OL_ITEM', parseInline(it.text).map(p => p.text).join(' '), { num: it.num }))
      continue
    }

    // Table
    if (/^\|.+\|/.test(line)) {
      const tl = []
      while (i < lines.length && /^\|/.test(lines[i])) { tl.push(lines[i]); i++ }
      tl.forEach((row, ti) => {
        if (/^\|[-| :]+\|/.test(row)) return
        const cells = row.split('|').map(c => c.trim()).filter(Boolean)
        push(ti === 0 ? 'TABLE_HEAD' : 'TABLE_ROW', cells.join(', '), { cells })
      })
      continue
    }

    // Blank
    if (line.trim() === '') { i++; continue }

    // Paragraph with inline parsing
    const pl = []
    while (i < lines.length && lines[i].trim() !== '' &&
           !/^[#>`|\d]/.test(lines[i]) && !/^\s*[-*+]\s/.test(lines[i]) &&
           !/^```/.test(lines[i]) && !/^(---+|\*\*\*+|___+)\s*$/.test(lines[i])) {
      pl.push(lines[i]); i++
    }
    if (pl.length) {
      const parts = parseInline(pl.join(' '))
      let buf = ''
      parts.forEach(p => {
        if (p.em === 'bold' || p.em === 'bolditalic') {
          if (buf.trim()) { push('PARAGRAPH', buf); buf = '' }
          push('BOLD', p.text)
        } else if (p.em === 'code') {
          if (buf.trim()) { push('PARAGRAPH', buf); buf = '' }
          push('CODE_INLINE', p.text)
        } else { buf += ' ' + p.text }
      })
      if (buf.trim()) push('PARAGRAPH', buf)
    }
  }

  return segments
}

// ── Speech params per segment type ──────────────────────────────────────────
// Piper doesn't support pitch/rate per utterance like Web Speech API does,
// but we control pauses, text prefixes, and speaking order.
// We map each type to: { spokenText, pauseBeforeMs, pauseAfterMs }
export function getSpokenText(seg) {
  switch (seg.type) {
    case 'H1':         return seg.text
    case 'H2':         return seg.text
    case 'H3':         return seg.text
    case 'H4':         return seg.text
    case 'PARAGRAPH':  return seg.text
    case 'BOLD':       return seg.text
    case 'CODE_BLOCK': return `Code block. ${seg.code ? '' : ''}`
    case 'CODE_INLINE':return seg.text
    case 'BLOCKQUOTE': return seg.text
    case 'LIST_ITEM':  return seg.text
    case 'OL_ITEM':    return `${seg.num}. ${seg.text}`
    case 'TABLE_HEAD': return `Table headers: ${seg.text}`
    case 'TABLE_ROW':  return seg.text
    case 'HR':         return 'Section break.'
    default:           return seg.text
  }
}

export function getPauses(type) {
  switch (type) {
    case 'H1':         return { before: 900, after: 650 }
    case 'H2':         return { before: 700, after: 500 }
    case 'H3':         return { before: 500, after: 320 }
    case 'H4':         return { before: 350, after: 220 }
    case 'BLOCKQUOTE': return { before: 380, after: 380 }
    case 'CODE_BLOCK': return { before: 420, after: 420 }
    case 'LIST_ITEM':  return { before: 130, after: 80  }
    case 'OL_ITEM':    return { before: 130, after: 80  }
    case 'TABLE_HEAD': return { before: 420, after: 220 }
    case 'HR':         return { before: 750, after: 750 }
    case 'BOLD':       return { before: 80,  after: 80  }
    case 'CODE_INLINE':return { before: 60,  after: 60  }
    default:           return { before: 0,   after: 200 }
  }
}
