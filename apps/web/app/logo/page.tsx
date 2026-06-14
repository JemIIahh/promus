'use client'

import { useEffect, useState } from 'react'

/**
 * Logo studio. Renders the Promus wordmark in the brand font (Cal Sans) and
 * exports high-res transparent/solid PNGs you can download. Not linked from
 * nav — a utility page at /logo.
 */

const WEIGHT = 400
// Fraunces (the display serif) is self-hosted by next/font under a hashed
// family name exposed via the --font-fraunces CSS var. Resolve it at runtime
// so the canvas export renders in the same face as the page.
let FRAUNCES = "'Fraunces', Georgia, serif"
let fontPromise: Promise<unknown> | null = null
function ensureFont() {
  if (typeof window === 'undefined') return Promise.resolve()
  if (!fontPromise) {
    const resolved = getComputedStyle(document.documentElement)
      .getPropertyValue('--font-fraunces')
      .trim()
    if (resolved) FRAUNCES = `${resolved}, Georgia, serif`
    fontPromise = Promise.all([
      document.fonts.load(`${WEIGHT} 240px ${FRAUNCES}`),
      document.fonts.load(`300 240px ${FRAUNCES}`),
    ]).then(() => document.fonts.ready)
  }
  return fontPromise
}

async function renderCanvas(text: string, fg: string, bg: string | null) {
  await ensureFont()
  const fontPx = 440
  const c = document.createElement('canvas')
  const ctx = c.getContext('2d')!
  const fontStr = `${WEIGHT} ${fontPx}px ${FRAUNCES}`
  ctx.font = fontStr
  const m = ctx.measureText(text)
  const asc = m.actualBoundingBoxAscent || fontPx * 0.74
  const desc = m.actualBoundingBoxDescent || fontPx * 0.26
  const padX = Math.round(fontPx * 0.7)
  const padY = Math.round(fontPx * 0.62)
  c.width = Math.ceil(m.width + padX * 2)
  c.height = Math.ceil(asc + desc + padY * 2)
  ctx.font = fontStr // canvas resize resets context state
  ctx.textBaseline = 'alphabetic'
  ctx.imageSmoothingQuality = 'high'
  if (bg) {
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, c.width, c.height)
  }
  ctx.fillStyle = fg
  ctx.fillText(text, padX, padY + asc)
  return c
}

async function download(text: string, fg: string, bg: string | null, file: string) {
  const c = await renderCanvas(text, fg, bg)
  c.toBlob(blob => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = file
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 2000)
  }, 'image/png')
}

const CASES = [
  { key: 'title', label: 'Promus', fn: (s: string) => s },
  { key: 'lower', label: 'promus', fn: (s: string) => s.toLowerCase() },
  { key: 'upper', label: 'PROMUS', fn: (s: string) => s.toUpperCase() },
] as const

const VARIANTS = [
  { label: 'Black on white', fg: '#0a0a0a', bg: '#ffffff', slug: 'black-on-white' },
  { label: 'White on black', fg: '#ffffff', bg: '#0a0a0a', slug: 'white-on-black' },
  { label: 'Black · transparent', fg: '#0a0a0a', bg: null, slug: 'black-transparent' },
  { label: 'White · transparent', fg: '#ffffff', bg: null, slug: 'white-transparent' },
] as const

export default function LogoStudio() {
  const [ready, setReady] = useState(false)
  const [caseKey, setCaseKey] = useState<(typeof CASES)[number]['key']>('title')
  useEffect(() => {
    ensureFont().then(() => setReady(true))
  }, [])

  const caseFn = CASES.find(c => c.key === caseKey)!.fn
  const word = caseFn('Promus')

  return (
    <main className="min-h-screen bg-[#f4f4f5] px-6 py-16 text-[#0a0a0a]" style={{ fontFamily: 'system-ui, sans-serif' }}>
      <div className="mx-auto max-w-[960px]">
        <header className="mb-10">
          <p className="text-[12px] uppercase tracking-[0.2em] text-[#71717a]">Promus · brand</p>
          <h1 className="mt-2 text-[28px] font-semibold tracking-tight">Logo / wordmark</h1>
          <p className="mt-2 max-w-[60ch] text-[14px] leading-relaxed text-[#52525b]">
            Pick a casing, then download the PNG you need. Transparent versions are best for placing
            the logo on any background. Rendered in the brand font (Cal Sans) at ~1500px wide.
          </p>
        </header>

        {/* case toggle */}
        <div className="mb-8 inline-flex overflow-hidden rounded-lg border border-[#d4d4d8]">
          {CASES.map(c => (
            <button
              key={c.key}
              type="button"
              onClick={() => setCaseKey(c.key)}
              className={`px-4 py-2 text-[14px] transition-colors ${
                caseKey === c.key ? 'bg-[#0a0a0a] text-white' : 'bg-white text-[#3f3f46] hover:bg-[#fafafa]'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {VARIANTS.map(v => (
            <div key={v.slug} className="overflow-hidden rounded-xl border border-[#e4e4e7] bg-white">
              {/* preview */}
              <div
                className="flex h-[180px] items-center justify-center"
                style={{
                  background: v.bg ?? 'transparent',
                  backgroundImage: v.bg
                    ? undefined
                    : 'conic-gradient(#e8e8ea 0 25%, #f6f6f7 0 50%, #e8e8ea 0 75%, #f6f6f7 0)',
                  backgroundSize: v.bg ? undefined : '22px 22px',
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--font-fraunces), Georgia, serif',
                    fontWeight: WEIGHT,
                    color: v.fg,
                    fontSize: 68,
                    lineHeight: 1,
                  }}
                >
                  {word}
                </span>
              </div>
              {/* footer */}
              <div className="flex items-center justify-between border-t border-[#e4e4e7] px-4 py-3">
                <span className="text-[13px] text-[#52525b]">{v.label}</span>
                <button
                  type="button"
                  onClick={() => download(word, v.fg, v.bg, `promus-${caseKey}-${v.slug}.png`)}
                  className="rounded-md bg-[#0a0a0a] px-3.5 py-1.5 text-[13px] font-medium text-white transition-opacity hover:opacity-85"
                >
                  Download PNG
                </button>
              </div>
            </div>
          ))}
        </div>

        {!ready && (
          <p className="mt-6 text-[13px] text-[#a1a1aa]">Loading brand font…</p>
        )}
      </div>
    </main>
  )
}
