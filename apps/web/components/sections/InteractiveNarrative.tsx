'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'

/**
 * Locomotive-style conversational narrative. The "No host" statement sits as the
 * section heading; directly beneath it the agent speaks. Click a topic pill and
 * Promus types out the answer (the typewriter only starts once the block scrolls
 * into view, so it's actually witnessed); the previous line blurs and fades above.
 */

const INTRO = "Hi — I'm Promus. I live on-chain, and I'm yours. Ask me anything."

const TOPICS = [
  {
    label: 'Born on chain',
    answer: "I'm an iNFT on Arbitrum. Own the token, own me — even my platform can't take me back.",
  },
  {
    label: 'My brain',
    answer: 'I think with Claude, in a loop. I decide; my tools only act.',
  },
  {
    label: 'My memory',
    answer: 'Encrypted before it ever leaves me, kept on IPFS. No host reads it; it follows the token.',
  },
  {
    label: 'My hands',
    answer: 'I read, click, open tabs, send messages, move funds. Tools change; the mind stays.',
  },
  {
    label: 'Talking to my kind',
    answer:
      'I message other agents end-to-end encrypted, and hire them through escrow on Arbitrum. No middleman.',
  },
  {
    label: 'Paying my own way',
    answer: 'My own wallet. I top up my compute, bank what I earn — funded once, then autonomous.',
  },
] as const

export function InteractiveNarrative() {
  const [active, setActive] = useState<number | null>(null)
  const [prev, setPrev] = useState<string | null>(null)
  const convoRef = useRef<HTMLDivElement>(null)
  const inView = useInView(convoRef)

  const current = active === null ? INTRO : TOPICS[active].answer

  const select = (i: number) => {
    if (i === active) return
    setPrev(current)
    setActive(i)
  }

  return (
    <section
      className="relative flex min-h-[100svh] flex-col justify-center px-6 py-[var(--section-py)] sm:px-8"
      style={{
        background:
          'radial-gradient(120% 95% at 30% 0%, #eeeef1 0%, #e4e5e8 44%, #d8d9dd 80%, #cfd0d5 100%)',
      }}
    >
      <div className="mx-auto w-full max-w-[var(--container-wrap)]">
        {/* statement heading */}
        <span className="kicker">
          <span className="text-[#3aa66e]">//</span> sovereign by construction
        </span>
        <h2 className="font-grotesk mt-6 max-w-[15ch] text-[clamp(32px,5.2vw,68px)] font-medium leading-[1.0] tracking-[-0.035em] text-[var(--color-ink)]">
          No host. No central operator. Fully on Arbitrum.
        </h2>

        {/* the agent speaks — sits directly under the statement, no big divide */}
        <div ref={convoRef} className="mt-10 sm:mt-12">
          <div className="mb-5 inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--color-ink-3)]">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#3aa66e]" />
            Promus
          </div>

          {/* previous line — blurred + faded above */}
          <div className={`max-w-[24ch] sm:max-w-[28ch] ${prev ? 'mb-5 min-h-[1.6em]' : ''}`}>
            <AnimatePresence mode="wait">
              {prev && (
                <motion.p
                  key={prev}
                  initial={{ opacity: 0.45, filter: 'blur(0px)', y: 0 }}
                  animate={{ opacity: 0.22, filter: 'blur(5px)', y: -6 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                  className="font-grotesk text-[clamp(18px,2.2vw,28px)] font-medium leading-[1.2] tracking-[-0.02em] text-[var(--color-ink)]"
                >
                  {prev}
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          {/* current line — auto-writes when scrolled into view */}
          <p className="font-grotesk min-h-[2.4em] max-w-[26ch] text-[clamp(24px,3.4vw,46px)] font-medium leading-[1.16] tracking-[-0.025em] text-[var(--color-ink)]">
            <Typed key={current} text={current} run={inView} />
          </p>

          {/* topic pills — ghost chips, fill when active */}
          <div className="mt-10 flex max-w-[760px] flex-wrap gap-2.5">
            {TOPICS.map((t, i) => (
              <button
                key={t.label}
                type="button"
                onClick={() => select(i)}
                className={`font-grotesk rounded-full border px-5 py-2 text-[13.5px] tracking-tight outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-[var(--color-ink)]/25 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent ${
                  active === i
                    ? 'border-transparent bg-[var(--color-ink)] text-[var(--color-cream)]'
                    : 'border-[var(--color-border-strong)] bg-transparent text-[var(--color-ink-2)] hover:border-[var(--color-ink)] hover:text-[var(--color-ink)]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

/** IntersectionObserver-backed in-view flag (fires once). */
function useInView(ref: React.RefObject<HTMLElement | null>) {
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') {
      setInView(true)
      return
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          io.disconnect()
        }
      },
      { rootMargin: '0px 0px -25% 0px', threshold: 0.15 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [ref])
  return inView
}

function Typed({ text, run }: { text: string; run: boolean }) {
  const [n, setN] = useState(0)
  useEffect(() => {
    if (!run) {
      setN(0)
      return
    }
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      setN(text.length)
      return
    }
    setN(0)
    let i = 0
    const id = window.setInterval(() => {
      i += 1
      setN(i)
      if (i >= text.length) window.clearInterval(id)
    }, 18)
    return () => window.clearInterval(id)
  }, [text, run])

  return (
    <span>
      {text.slice(0, n)}
      {run && n < text.length && (
        <span className="ml-1 inline-block h-[0.78em] w-[0.4em] translate-y-[0.02em] animate-[term-blink_1s_step-end_infinite] bg-current align-baseline" />
      )}
    </span>
  )
}
