'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { ShaderCanvas } from './MotionScreen'

/**
 * The interactive hero screen. Idle = a serious dark "living screen" (Locomotive
 * CRT feel) with a "click to start" prompt. On click it animates into the Promus
 * conversation — agent messages auto-write (typewriter) like a real assistant —
 * and a redesigned "behind the chat" on-chain trail is one click away.
 */

type Step =
  | { role: 'user'; text: string }
  | { role: 'agent'; text: string }
  | { role: 'tools'; items: string[] }

const SCRIPT: Step[] = [
  { role: 'user', text: 'gm' },
  { role: 'agent', text: 'gm ☀️' },
  { role: 'user', text: 'send 0.01 ETH to vault.eth for the monthly reserve' },
  {
    role: 'tools',
    items: [
      'chain.read · balanceOf(self)',
      'chain.read · resolve vault.eth',
      'chain.send · 0.01 ETH → 0x4f7a…d4c0',
      'memory.save · /user/treasury',
    ],
  },
  {
    role: 'agent',
    text: 'Done — 0.01 ETH sent to vault.eth on Arbitrum. Gas 0.00002 ETH, new balance 0.041 ETH. Receipt encrypted and pinned to your memory.',
  },
]

const GAPS = [650, 1050, 1600, 2200, 2400] // ms between reveals

const TRAIL = [
  { k: 'You', t: 'You set the intent. The agent decided how to act — and paid from its own wallet, not yours.' },
  { k: 'Brain', t: 'Claude resolved vault.eth and confirmed the balance before drafting the transfer.' },
  { k: 'Chain', t: 'A real transaction settled from the agent EOA on Arbitrum.', verify: true },
  { k: 'Memory', t: 'The receipt was encrypted client-side and pinned to IPFS, anchored in the iNFT.', verify: true },
] as const

export function InteractiveScreen() {
  const [started, setStarted] = useState(false)
  const [visible, setVisible] = useState(0)
  const [showTrail, setShowTrail] = useState(false)
  const timers = useRef<number[]>([])

  useEffect(() => {
    if (!started) return
    let t = 0
    SCRIPT.forEach((_, i) => {
      t += GAPS[i] ?? 1400
      timers.current.push(window.setTimeout(() => setVisible(i + 1), t))
    })
    const handle = timers.current
    return () => {
      for (const id of handle) window.clearTimeout(id)
      handle.length = 0
    }
  }, [started])

  const restart = () => {
    for (const id of timers.current) window.clearTimeout(id)
    timers.current = []
    setVisible(0)
    setShowTrail(false)
    setStarted(false)
    requestAnimationFrame(() => setStarted(true))
  }

  const done = visible >= SCRIPT.length
  const nextIsAgent = started && visible < SCRIPT.length && SCRIPT[visible]?.role === 'agent'

  return (
    <div className="relative aspect-[16/10] w-full overflow-hidden rounded-[22px] bg-[#06080b] ring-1 ring-black/15 shadow-[0_2px_4px_rgba(16,15,20,0.10),0_14px_30px_-10px_rgba(16,15,20,0.24),0_54px_104px_-42px_rgba(16,15,20,0.58),inset_0_1px_0_rgba(255,255,255,0.10)]">
      <ShaderCanvas />

      {/* IDLE — click to start */}
      <AnimatePresence>
        {!started && (
          <motion.button
            type="button"
            onClick={() => setStarted(true)}
            exit={{ opacity: 0, transition: { duration: 0.5 } }}
            className="group absolute inset-0 z-20 flex cursor-pointer flex-col items-center justify-center"
            aria-label="Start the demo"
          >
            <span className="font-grotesk text-[clamp(16px,1.9vw,22px)] font-medium tracking-tight text-white/90 transition-transform group-hover:-translate-y-0.5">
              [ click to start ]
              <span className="term-cursor ml-1 align-middle" />
            </span>
            <span className="font-grotesk mt-3 text-[12.5px] text-white/45">
              watch Promus act on Arbitrum
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* STARTED — glass + content */}
      <AnimatePresence>
        {started && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.55, ease: 'easeOut' }}
            className="absolute inset-0 z-10 flex flex-col bg-[#06080b]/82 backdrop-blur-md"
          >
            <div className="flex shrink-0 items-center gap-3 border-b border-white/8 px-5 py-3.5 sm:px-7">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-[conic-gradient(from_140deg,#3a6b8f,#5a7a8f,#8f7a5a,#3a6b8f)] text-[13px] font-semibold text-[#06080b]">
                P
              </span>
              <div className="font-grotesk leading-tight">
                <div className="text-[14px] font-semibold text-white">Promus</div>
                <div className="flex items-center gap-1.5 text-[11.5px] text-[#7fd0a4]">
                  <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[#7fd0a4]" />
                  online
                </div>
              </div>
              <span className="font-grotesk ml-auto text-[11px] tracking-wide text-white/35">
                live on Arbitrum
              </span>
            </div>

            <AnimatePresence mode="wait">
              {showTrail ? (
                <TrailView key="trail" onBack={() => setShowTrail(false)} />
              ) : (
                <motion.div
                  key="chat"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-1 flex-col justify-end gap-3 overflow-y-auto px-5 py-5 sm:px-8 sm:py-7"
                >
                  {SCRIPT.slice(0, visible).map((s, i) => (
                    <Bubble key={i} step={s} />
                  ))}
                  {nextIsAgent && <Typing />}

                  {done && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.5 }}
                      className="mt-1 flex items-center justify-center gap-2"
                    >
                      <button
                        type="button"
                        onClick={() => setShowTrail(true)}
                        className="font-grotesk rounded-full bg-white/10 px-4 py-1.5 text-[12px] text-white/85 ring-1 ring-white/12 transition-colors hover:bg-white/15"
                      >
                        behind the chat →
                      </button>
                      <button
                        type="button"
                        onClick={restart}
                        className="font-grotesk rounded-full px-3 py-1.5 text-[12px] text-white/50 transition-colors hover:text-white/80"
                      >
                        ↻ replay
                      </button>
                    </motion.div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Bubble({ step }: { step: Step }) {
  const enter = {
    initial: { opacity: 0, y: 10, scale: 0.98 },
    animate: { opacity: 1, y: 0, scale: 1 },
    transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
  }

  if (step.role === 'user') {
    return (
      <motion.div {...enter} className="flex justify-end">
        <div className="font-grotesk max-w-[78%] rounded-2xl rounded-br-md bg-[#27485f] px-4 py-2.5 text-[14.5px] leading-snug text-white">
          {step.text}
        </div>
      </motion.div>
    )
  }

  if (step.role === 'tools') {
    return (
      <motion.div {...enter} className="flex justify-start">
        <div className="max-w-[82%] space-y-1.5 rounded-2xl rounded-bl-md bg-white/[0.05] px-3.5 py-3 ring-1 ring-white/8">
          {step.items.map((it, i) => (
            <motion.div
              key={it}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 + i * 0.35, duration: 0.3 }}
              className="flex items-center gap-2 font-mono text-[12.5px] text-white/70"
            >
              <span className="text-[#7fb0d0]">⚙</span>
              <span className="flex-1">{it}</span>
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.15 + i * 0.35 + 0.25 }}
                className="text-[#7fd0a4]"
              >
                ✓
              </motion.span>
            </motion.div>
          ))}
        </div>
      </motion.div>
    )
  }

  // agent — auto-writes (typewriter)
  return (
    <motion.div {...enter} className="flex justify-start">
      <div className="font-grotesk max-w-[82%] rounded-2xl rounded-bl-md bg-[#13171e] px-4 py-2.5 text-[14.5px] leading-relaxed text-white/90">
        <Typewriter text={step.text} />
      </div>
    </motion.div>
  )
}

function Typewriter({ text, speed = 20 }: { text: string; speed?: number }) {
  const [n, setN] = useState(0)
  useEffect(() => {
    setN(0)
    const id = window.setInterval(() => {
      setN(v => {
        if (v >= text.length) {
          window.clearInterval(id)
          return v
        }
        return v + 1
      })
    }, speed)
    return () => window.clearInterval(id)
  }, [text, speed])
  return (
    <span>
      {text.slice(0, n)}
      {n < text.length && <span className="term-cursor ml-0.5 inline-block !h-[0.9em] !w-[0.45em]" />}
    </span>
  )
}

function Typing() {
  return (
    <div className="flex justify-start">
      <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md bg-[#13171e] px-4 py-3.5">
        {[0, 1, 2].map(i => (
          <motion.span
            key={i}
            className="inline-block h-1.5 w-1.5 rounded-full bg-white/50"
            animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
            transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY, delay: i * 0.18 }}
          />
        ))}
      </div>
    </div>
  )
}

function TrailView({ onBack }: { onBack: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -16 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-1 flex-col overflow-y-auto px-6 py-6 sm:px-9 sm:py-8"
    >
      <div className="mb-6 flex items-baseline justify-between">
        <div>
          <h3 className="font-grotesk text-[clamp(18px,2vw,24px)] font-medium tracking-tight text-white">
            behind the chat
          </h3>
          <p className="font-grotesk mt-1 text-[13px] text-white/45">
            every step above left a trail on Arbitrum
          </p>
        </div>
        <span className="font-mono text-[11px] text-white/30">Transfer · 14:32</span>
      </div>

      <div className="relative space-y-5 pl-5">
        <span className="absolute left-[3px] top-1.5 bottom-1.5 w-px bg-white/10" />
        {TRAIL.map((s, i) => (
          <motion.div
            key={s.k}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.12, duration: 0.4 }}
            className="relative"
          >
            <span className="absolute -left-5 top-1.5 h-1.5 w-1.5 rounded-full bg-white/60 ring-4 ring-[#06080b]" />
            <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/40">{s.k}</div>
            <div className="font-grotesk mt-1 text-[14px] leading-relaxed text-white/85">{s.t}</div>
            {'verify' in s && s.verify && (
              <button
                type="button"
                className="font-mono mt-1 text-[11.5px] text-[#7fb0d0] transition-colors hover:text-[#a8d0e8]"
              >
                verify on chain ↗
              </button>
            )}
          </motion.div>
        ))}
      </div>

      <button
        type="button"
        onClick={onBack}
        className="font-grotesk mt-auto self-start pt-5 text-[12px] text-white/50 transition-colors hover:text-white/85"
      >
        ← back to chat
      </button>
    </motion.div>
  )
}
