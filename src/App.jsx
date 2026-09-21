import { memo, useCallback, useEffect, useMemo, useState, useDeferredValue } from 'react'
import {
  AlertOctagon,
  AlertTriangle,
  Bug,
  Check,
  ChevronDown,
  Clock,
  Copy,
  FileText,
  Info,
  Share2,
  ShieldCheck,
  Terminal,
  Trash2,
} from 'lucide-react'
import { PI_ERRORS, normalizeCode } from './piErrors'

/* ------------------------------------------------------------------ */
/* Parsing (unchanged)                                                 */
/* ------------------------------------------------------------------ */

const PAGE = 1500

// Prefix groups instead of lookbehind so older tablet browsers (Safari < 16.4) still work.
const CODE_RE = /(^|[^\w.])(-\d{3,6}|0x[0-9A-Fa-f]{8})(?!\w|\.\d)/g
const WSA_RE = /\b(?:WSA\w*|winsock error|socket error|error code|error)[\s:=#(]{0,4}(10048|10051|10053|10054|10060|10061|10065)(?!\d)/gi
const EPOCH_RE = /(^|[^\d.])(\d{10}|\d{13})(?:\.(\d{1,9}))?(?!\d)/g

const MIN_S = 946684800 // 2000-01-01
const MAX_S = 4102444800 // 2100-01-01

const ZERO_ERR_RE = /\b(0|no|zero)\s+errors?\b/i
const ERR_RE = /\b(errors?|err|fail|failed|failure|fatal|critical|exception|denied|unable|cannot|can't|timed out|refused)\b/i
const WARN_RE = /\b(warn|warning|warnings|retry|retrying|reconnect|reconnecting|disconnect|disconnected|lost|stale)\b/i
const DEBUG_RE = /\b(debug|trace|verbose|dbg)\b/i

function decodeEpoch(whole, frac) {
  const isMs = whole.length === 13
  const n = Number(whole)
  const sec = isMs ? n / 1000 : n
  if (sec < MIN_S || sec > MAX_S) return null
  let ms = isMs ? n : n * 1000
  if (frac) ms += Number('0.' + frac) * (isMs ? 1 : 1000)
  return { ms, hasMs: isMs || Boolean(frac) }
}

const fmtCache = {}
function formatMs(ms, utc, withMs) {
  const key = `${utc}-${withMs}`
  if (!fmtCache[key]) {
    fmtCache[key] = new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      ...(withMs ? { fractionalSecondDigits: 3 } : {}),
      hourCycle: 'h23',
      timeZone: utc ? 'UTC' : undefined,
      timeZoneName: 'short',
    })
  }
  return fmtCache[key].format(new Date(ms))
}

function tokenize(raw) {
  const tokens = []

  for (const m of raw.matchAll(CODE_RE)) {
    const text = m[2]
    const key = normalizeCode(text)
    if (PI_ERRORS[key]) {
      const start = m.index + m[1].length
      tokens.push({ type: 'code', key, start, end: start + text.length })
    }
  }

  for (const m of raw.matchAll(WSA_RE)) {
    const key = 'WSA' + m[1]
    if (PI_ERRORS[key]) {
      const end = m.index + m[0].length
      tokens.push({ type: 'code', key, start: end - m[1].length, end })
    }
  }

  for (const m of raw.matchAll(EPOCH_RE)) {
    const d = decodeEpoch(m[2], m[3])
    if (d) {
      const start = m.index + m[1].length
      const end = start + m[2].length + (m[3] ? m[3].length + 1 : 0)
      tokens.push({ type: 'epoch', start, end, ms: d.ms, hasMs: d.hasMs })
    }
  }

  tokens.sort((a, b) => a.start - b.start)
  const clean = []
  let last = 0
  for (const t of tokens) {
    if (t.start >= last) {
      clean.push(t)
      last = t.end
    }
  }
  return clean
}

function classify(raw, issues) {
  if (issues.length) return issues.some((i) => i.info.severity === 'error') ? 'error' : 'warning'
  if (DEBUG_RE.test(raw)) return 'debug'
  if (ERR_RE.test(raw) && !ZERO_ERR_RE.test(raw)) return 'error'
  if (WARN_RE.test(raw)) return 'warning'
  return 'info'
}

function parseLog(text) {
  const lines = []
  const summary = new Map()
  const counts = { error: 0, warning: 0, info: 0, debug: 0 }
  let epochs = 0
  const rawLines = text ? text.split(/\r?\n/) : []

  for (let i = 0; i < rawLines.length; i++) {
    const raw = rawLines[i]
    if (!raw.trim()) continue
    const tokens = tokenize(raw)
    const issues = []
    const seen = new Set()

    for (const t of tokens) {
      if (t.type === 'epoch') {
        epochs++
        continue
      }
      if (!seen.has(t.key)) {
        seen.add(t.key)
        issues.push({ key: t.key, info: PI_ERRORS[t.key] })
      }
      const s = summary.get(t.key) ?? { key: t.key, info: PI_ERRORS[t.key], count: 0, firstLine: i + 1 }
      s.count++
      summary.set(t.key, s)
    }

    const level = classify(raw, issues)
    counts[level]++
    lines.push({ n: i + 1, raw, level, tokens, issues })
  }

  return {
    lines,
    counts,
    epochs,
    summary: [...summary.values()].sort((a, b) => b.count - a.count),
  }
}

/* Text placed on the clipboard by the per-line Copy button */
function buildCopyText(line, utc) {
  const out = [line.raw]
  for (const t of line.tokens) {
    if (t.type === 'epoch') {
      out.push(`Timestamp ${line.raw.slice(t.start, t.end)} = ${formatMs(t.ms, utc, t.hasMs)}`)
    }
  }
  for (const { info } of line.issues) {
    out.push(`${info.label}: ${info.title}. ${info.meaning} Fix: ${info.fix}`)
  }
  return out.join('\n')
}

/* ------------------------------------------------------------------ */
/* UI bits                                                             */
/* ------------------------------------------------------------------ */

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'warn', label: 'Errors + Warnings' },
  { id: 'error', label: 'Errors only' },
]

const LEVEL_STYLE = {
  error: { row: 'border-l-red-500 bg-red-950/30', tag: 'text-red-400', Icon: AlertOctagon, label: 'ERR' },
  warning: { row: 'border-l-amber-500 bg-amber-950/20', tag: 'text-amber-400', Icon: AlertTriangle, label: 'WRN' },
  info: { row: 'border-l-slate-700', tag: 'text-sky-400', Icon: Info, label: 'INF' },
  debug: { row: 'border-l-slate-800 opacity-60', tag: 'text-slate-500', Icon: Bug, label: 'DBG' },
}

const SAMPLE = [
  '25-Jan-26 08:14:02 opcint1> Starting OPC interface, scan class 1 = 00:00:05',
  '25-Jan-26 08:14:03 opcint1> DEBUG: group created, 1200 items queued',
  '25-Jan-26 08:14:04 opcint1> Connecting to OPC server Matrikon.OPC.Simulation.1 on SCADA-OPC01',
  '25-Jan-26 08:14:09 opcint1> Error connecting to OPC server: 0x800706BA',
  '25-Jan-26 08:14:09 opcint1> Retrying connection in 30 seconds',
  '25-Jan-26 08:14:39 opcint1> Connected to OPC server. 1200 tags added',
  '25-Jan-26 08:15:12 opcint1> Tag PUMP01.FLOW quality Bad, last good value at 1769328900',
  '1769329005 opcint1> [-10722] PINET: Timeout on PI RPC or system call',
  '1769329010123 bufserv> Lost connection to PI server PIDA01, buffering events',
  '25-Jan-26 08:17:41 opcint1> Failed to write tag TANK02.LEVEL [-10401]',
  '25-Jan-26 08:18:03 opcint1> Winsock error 10061 while connecting to PIDA01:5450',
  '25-Jan-26 08:18:40 opcint1> Item ID not found: 0xC0040007 (Channel1.Device1.Tag9)',
  '25-Jan-26 08:19:00 opcint1> Scan class 1 completed, 0 errors',
].join('\n')

const LogRow = memo(function LogRow({ line, utc, copied, onCopy }) {
  const s = LEVEL_STYLE[line.level]
  const parts = []
  let pos = 0

  line.tokens.forEach((t, i) => {
    if (t.start > pos) parts.push(line.raw.slice(pos, t.start))
    const text = line.raw.slice(t.start, t.end)
    if (t.type === 'epoch') {
      parts.push(
        <span key={i}>
          <span className="text-sky-300">{text}</span>
          <span className="ml-1 rounded bg-sky-500/10 px-1 text-sky-300 ring-1 ring-sky-500/30">
            → {formatMs(t.ms, utc, t.hasMs)}
          </span>
        </span>,
      )
    } else {
      parts.push(
        <mark key={i} className="rounded bg-red-500/25 px-1 font-semibold text-red-300">
          {text}
        </mark>,
      )
    }
    pos = t.end
  })
  if (pos < line.raw.length) parts.push(line.raw.slice(pos))

  return (
    <div className={`border-l-[3px] px-2 py-px ${s.row}`}>
      <div className="flex gap-2 font-mono text-xs leading-5">
        <span className="w-10 shrink-0 select-none text-right text-slate-600">{line.n}</span>
        <span className={`w-7 shrink-0 select-none font-semibold ${s.tag}`}>{s.label}</span>
        <span className="min-w-0 flex-1 whitespace-pre-wrap break-all">{parts}</span>
        <button
          onClick={() => onCopy(line)}
          title="Copy this line with its explanation and fix"
          aria-label={`Copy line ${line.n}`}
          className="mt-0.5 h-4 w-4 shrink-0 text-slate-600 hover:text-sky-300 focus:outline-none focus-visible:text-sky-300"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </div>
      {line.issues.map(({ key, info }) => (
        <div
          key={key}
          className="my-0.5 ml-[5.25rem] flex gap-1.5 rounded border border-red-900/60 bg-red-950/50 px-2 py-0.5 text-[11px] leading-4 text-red-200"
        >
          <AlertOctagon className="mt-px h-3 w-3 shrink-0 text-red-400" />
          <span>
            <b className="text-red-100">
              {info.label}: {info.title}.
            </b>{' '}
            {info.meaning} <span className="text-red-300/80">Fix: {info.fix}</span>
          </span>
        </div>
      ))}
    </div>
  )
})

/* ------------------------------------------------------------------ */
/* App                                                                 */
/* ------------------------------------------------------------------ */

export default function App() {
  const [text, setText] = useState('')
  const [filter, setFilter] = useState('all')
  const [utc, setUtc] = useState(false)
  const [limit, setLimit] = useState(PAGE)
  const [epochInput, setEpochInput] = useState('')
  const [toast, setToast] = useState('')
  const [summaryOpen, setSummaryOpen] = useState(true)
  const [copiedLine, setCopiedLine] = useState(null)

  const deferred = useDeferredValue(text)
  const parsed = useMemo(() => parseLog(deferred), [deferred])

  const visible = useMemo(
    () =>
      parsed.lines.filter((l) => {
        if (filter === 'all') return true
        if (filter === 'warn') return l.level === 'error' || l.level === 'warning'
        return l.level === 'error'
      }),
    [parsed, filter],
  )

  const totalIssues = useMemo(() => parsed.summary.reduce((a, s) => a + s.count, 0), [parsed])

  useEffect(() => {
    setLimit(PAGE)
  }, [deferred, filter])

  useEffect(() => {
    if (!toast) return undefined
    const id = setTimeout(() => setToast(''), 2500)
    return () => clearTimeout(id)
  }, [toast])

  useEffect(() => {
    if (copiedLine === null) return undefined
    const id = setTimeout(() => setCopiedLine(null), 1500)
    return () => clearTimeout(id)
  }, [copiedLine])

  const quick = useMemo(() => {
    const m = epochInput.trim().match(/^(\d{10}|\d{13})(?:\.(\d{1,9}))?$/)
    return m ? decodeEpoch(m[1], m[2]) : null
  }, [epochInput])

  const tzName = Intl.DateTimeFormat().resolvedOptions().timeZone

  const handleCopy = useCallback(
    async (line) => {
      try {
        await navigator.clipboard.writeText(buildCopyText(line, utc))
        setCopiedLine(line.n)
      } catch {
        setToast('Copy failed. Select the text manually.')
      }
    },
    [utc],
  )

  async function handleShare() {
    const url = window.location.origin + window.location.pathname
    const data = {
      title: 'PI Interface Log Parser & Epoch Decoder',
      text: 'Offline PI/OPC interface log parser with PI error translation and epoch decoding.',
      url,
    }
    try {
      if (navigator.share) {
        await navigator.share(data)
      } else {
        await navigator.clipboard.writeText(url)
        setToast('Link copied to clipboard')
      }
    } catch (err) {
      if (err && err.name !== 'AbortError') setToast('Sharing is not available here')
    }
  }

  const btn =
    'rounded-md border px-2.5 py-1 text-xs font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500'

  return (
    // Desktop (lg+): the page itself never scrolls; each pane scrolls internally.
    // Narrow screens: normal page scroll with fixed-height panes.
    <div className="flex min-h-dvh flex-col bg-slate-950 text-slate-200 lg:h-dvh lg:overflow-hidden">
      <header className="shrink-0 border-b border-slate-800 bg-slate-950">
        <div className="mx-auto flex max-w-[1800px] flex-wrap items-center justify-between gap-2 px-4 py-2">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-sky-500/10 p-1.5 ring-1 ring-sky-500/30">
              <Terminal className="h-5 w-5 text-sky-400" />
            </div>
            <div>
              <h1 className="text-base font-semibold leading-tight text-slate-100">
                PI Interface Log Parser &amp; Epoch Decoder
              </h1>
              <p className="text-[11px] leading-tight text-slate-400">pipc.log and OPC interface troubleshooting</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-300 sm:inline-flex">
              <ShieldCheck className="h-3.5 w-3.5" /> Runs offline. Nothing leaves this browser.
            </span>
            <button
              onClick={handleShare}
              className="inline-flex items-center gap-1.5 rounded-md bg-sky-500 px-3 py-1.5 text-sm font-medium text-slate-950 hover:bg-sky-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
            >
              <Share2 className="h-4 w-4" /> Share
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-[1800px] flex-1 gap-3 p-3 lg:min-h-0 lg:grid-cols-2 lg:overflow-hidden">
        {/* LEFT: raw input (fills the column and scrolls internally) + epoch decoder */}
        <div className="flex min-w-0 flex-col gap-3 lg:min-h-0">
          <section
            aria-labelledby="input-h"
            className="flex min-h-[16rem] flex-col rounded-xl border border-slate-800 bg-slate-900/60 lg:min-h-0 lg:flex-1"
          >
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-800 px-3 py-2">
              <h2 id="input-h" className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                <FileText className="h-4 w-4 text-sky-400" /> Raw log input
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setText(SAMPLE)}
                  className={`${btn} border-slate-700 text-slate-300 hover:bg-slate-800`}
                >
                  Load sample
                </button>
                <button
                  onClick={() => setText('')}
                  className={`${btn} inline-flex items-center gap-1 border-slate-700 text-slate-300 hover:bg-slate-800`}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Clear
                </button>
              </div>
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              wrap="off"
              spellCheck={false}
              autoCorrect="off"
              autoCapitalize="off"
              autoComplete="off"
              aria-label="Paste pipc.log or OPC interface log text"
              placeholder="Paste pipc.log or OPC interface log text here..."
              className="min-h-0 w-full flex-1 resize-none overflow-auto rounded-b-xl bg-transparent p-3 font-mono text-xs leading-5 text-slate-200 placeholder:text-slate-600 focus:outline-none"
            />
          </section>

          <section
            aria-labelledby="epoch-h"
            className="shrink-0 rounded-xl border border-slate-800 bg-slate-900/60 p-3"
          >
            <h2 id="epoch-h" className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-100">
              <Clock className="h-4 w-4 text-sky-400" /> Epoch decoder
            </h2>
            <div className="flex gap-2">
              <input
                value={epochInput}
                onChange={(e) => setEpochInput(e.target.value)}
                inputMode="decimal"
                spellCheck={false}
                autoComplete="off"
                placeholder="1769329005 or 1769329005123"
                aria-label="Unix epoch timestamp in seconds or milliseconds"
                className="min-w-0 flex-1 rounded-md border border-slate-700 bg-slate-950 px-3 py-1.5 font-mono text-sm text-slate-200 placeholder:text-slate-600 focus:border-sky-500 focus:outline-none"
              />
              <button
                onClick={() => setEpochInput(String(Math.floor(Date.now() / 1000)))}
                className={`${btn} border-slate-700 text-slate-300 hover:bg-slate-800`}
              >
                Now
              </button>
            </div>
            {epochInput.trim() && (
              <div className="mt-2 space-y-0.5 font-mono text-xs">
                {quick ? (
                  <>
                    <div>
                      <span className="text-slate-500">Local ({tzName}): </span>
                      <span className="text-sky-300">{formatMs(quick.ms, false, quick.hasMs)}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">UTC: </span>
                      <span className="text-sky-300">{formatMs(quick.ms, true, quick.hasMs)}</span>
                    </div>
                  </>
                ) : (
                  <div className="text-amber-400">
                    Enter a 10-digit (seconds) or 13-digit (ms) epoch between 2000 and 2100.
                  </div>
                )}
              </div>
            )}
          </section>
        </div>

        {/* RIGHT: filters, summary, parsed log (log lines scroll internally) */}
        <section
          aria-labelledby="out-h"
          className="flex min-h-[70vh] min-w-0 flex-col rounded-xl border border-slate-800 bg-slate-900/60 lg:min-h-0 lg:overflow-hidden"
        >
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-800 px-3 py-2">
            <h2 id="out-h" className="text-sm font-semibold text-slate-100">
              Parsed log
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <div role="group" aria-label="Filter log lines" className="flex gap-1">
                {FILTERS.map((f) => (
                  <button
                    key={f.id}
                    aria-pressed={filter === f.id}
                    onClick={() => setFilter(f.id)}
                    className={`${btn} ${
                      filter === f.id
                        ? 'border-sky-500 bg-sky-500/15 text-sky-300'
                        : 'border-slate-700 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setUtc((v) => !v)}
                aria-pressed={utc}
                title="Toggle timestamp display between local time and UTC"
                className={`${btn} inline-flex items-center gap-1 border-slate-700 text-slate-300 hover:bg-slate-800`}
              >
                <Clock className="h-3.5 w-3.5" /> {utc ? 'UTC' : `Local (${tzName})`}
              </button>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap gap-x-4 gap-y-0.5 border-b border-slate-800 px-3 py-1.5 text-xs text-slate-400">
            <span className="text-red-400">{parsed.counts.error} errors</span>
            <span className="text-amber-400">{parsed.counts.warning} warnings</span>
            <span className="text-sky-400">{parsed.counts.info} info</span>
            <span className="text-slate-500">{parsed.counts.debug} debug</span>
            <span>{parsed.epochs} timestamps decoded</span>
          </div>

          {/* Executive summary of detected error codes */}
          <div className="shrink-0 border-b border-slate-800">
            <button
              onClick={() => setSummaryOpen((v) => !v)}
              aria-expanded={summaryOpen}
              className="flex w-full items-center justify-between px-3 py-1.5 text-left text-xs font-semibold text-slate-200 hover:bg-slate-800/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-500"
            >
              <span className="flex items-center gap-2">
                <AlertOctagon className="h-3.5 w-3.5 text-red-400" />
                Detected error codes
                <span className="rounded bg-slate-800 px-1.5 font-normal text-slate-400">
                  {parsed.summary.length} unique, {totalIssues} total
                </span>
              </span>
              <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition ${summaryOpen ? 'rotate-180' : ''}`} />
            </button>
            {summaryOpen && (
              <div className="max-h-36 overflow-y-auto px-3 pb-2">
                {parsed.summary.length === 0 ? (
                  <p className="text-xs text-slate-500">No known PI, OPC/COM or Winsock error codes found yet.</p>
                ) : (
                  <ul className="space-y-1">
                    {parsed.summary.map(({ key, info, count, firstLine }) => (
                      <li key={key}>
                        <details className="rounded-md border border-red-900/50 bg-red-950/20">
                          <summary className="flex cursor-pointer list-none items-center gap-2 px-2 py-1 text-xs [&::-webkit-details-marker]:hidden">
                            <code className="rounded bg-red-500/20 px-1.5 font-semibold text-red-300">
                              {info.label}
                            </code>
                            <span className="min-w-0 flex-1 truncate text-slate-200">{info.title}</span>
                            <span className="shrink-0 text-slate-400">
                              {count}x · line {firstLine}
                            </span>
                          </summary>
                          <div className="px-2 pb-1.5 text-xs leading-4 text-slate-300">
                            {info.meaning} <span className="text-red-300/90">Fix: {info.fix}</span>
                          </div>
                        </details>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          {/* Log lines: the only part of this pane that scrolls */}
          <div className="max-h-[70vh] min-h-0 flex-1 overflow-y-auto py-1 lg:max-h-none">
            {parsed.lines.length === 0 ? (
              <p className="p-6 text-sm text-slate-500">Paste a log on the left, or click Load sample.</p>
            ) : visible.length === 0 ? (
              <p className="p-6 text-sm text-slate-500">No lines match this filter.</p>
            ) : (
              <>
                {visible.slice(0, limit).map((l) => (
                  <LogRow key={l.n} line={l} utc={utc} copied={copiedLine === l.n} onCopy={handleCopy} />
                ))}
                {visible.length > limit && (
                  <div className="p-3 text-center">
                    <button
                      onClick={() => setLimit((v) => v + PAGE)}
                      className={`${btn} border-slate-700 text-slate-300 hover:bg-slate-800`}
                    >
                      Show {Math.min(PAGE, visible.length - limit)} more ({visible.length - limit} remaining)
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      </main>

      {/* Collapsed by default. Content stays in the page for search engines. */}
      <footer className="shrink-0 border-t border-slate-800 bg-slate-950">
        <details className="group mx-auto max-w-[1800px] px-4 py-1.5">
          <summary className="flex cursor-pointer list-none select-none items-center gap-2 text-xs text-slate-500 hover:text-slate-300 [&::-webkit-details-marker]:hidden">
            <Info className="h-3.5 w-3.5" />
            About this tool
            <ChevronDown className="h-3.5 w-3.5 transition group-open:rotate-180" />
          </summary>
          <div className="max-h-[35vh] max-w-4xl overflow-y-auto py-3 text-sm leading-relaxed text-slate-400">
            <h2 className="mb-2 text-base font-semibold text-slate-200">What this PI log parser does</h2>
            <p className="mb-4">
              Paste text from pipc.log or an OPC interface log and the tool classifies every line as error, warning,
              info or debug, highlights known OSIsoft/AVEVA PI, OPC/COM and Winsock error codes, and explains each in
              plain English with a suggested fix. Unix epoch values in seconds or milliseconds are converted to your
              local time zone or UTC.
            </p>
            <h3 className="mb-1 font-medium text-slate-300">Is my log data uploaded anywhere?</h3>
            <p className="mb-4">
              No. All parsing runs in your browser with regular expressions and React state. After the first load the
              app is cached and works without a network connection, which suits air-gapped plant networks.
            </p>
            <h3 className="mb-1 font-medium text-slate-300">Which timestamps are detected?</h3>
            <p>
              10-digit Unix seconds and 13-digit Unix milliseconds between the years 2000 and 2100, with optional
              fractional seconds.
            </p>
          </div>
        </details>
      </footer>

      {toast && (
        <div
          role="status"
          className="fixed bottom-4 left-1/2 z-30 -translate-x-1/2 rounded-md border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-200 shadow-lg"
        >
          <span className="inline-flex items-center gap-2">
            <Check className="h-4 w-4 text-emerald-400" /> {toast}
          </span>
        </div>
      )}
    </div>
  )
}
