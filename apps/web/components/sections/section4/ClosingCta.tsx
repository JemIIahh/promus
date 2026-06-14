'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'

export function ClosingCta() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.4 }}
      transition={{ duration: 0.95, ease: [0.22, 1, 0.36, 1] }}
      className="relative isolate mx-auto w-full max-w-[var(--container-narrow)] overflow-hidden rounded-[24px] border border-[var(--color-border)] bg-[#eceef1] px-8 py-16 text-center sm:py-24"
      style={{ boxShadow: '0 60px 120px -70px rgba(16,15,20,0.32)' }}
    >
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-[#f3f4f6]/70 via-transparent to-[#e2e3e7]/70" />

      <span className="kicker mx-auto justify-center">
        <span className="text-[#3aa66e]">//</span> run it yourself
      </span>
      <h2 className="font-grotesk mt-6 text-[clamp(32px,5vw,64px)] font-medium leading-[1.0] tracking-[-0.03em] text-[var(--color-ink)]">
        Run a sovereign agent.
      </h2>
      <p className="mt-5 max-w-md mx-auto text-[16px] leading-relaxed text-[var(--color-ink-2)]">
        Mint once. The agent persists.
      </p>

      <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
        <Link
          href="/docs"
          className="group inline-flex items-center gap-2 rounded-full bg-[var(--color-ink)] px-7 py-3.5 text-[15px] font-medium tracking-tight text-[var(--color-cream)] shadow-[0_18px_40px_-22px_rgba(26,20,16,0.7)] transition-transform hover:-translate-y-0.5 hover:scale-[1.01] active:scale-[0.99]"
        >
          <span>Read the docs</span>
          <span aria-hidden className="transition-transform group-hover:translate-x-1">
            →
          </span>
        </Link>
        <Link
          href="https://github.com/JemIIahh/promus"
          target="_blank"
          rel="noreferrer"
          className="font-mono text-[12px] uppercase tracking-[0.22em] text-[var(--color-ink-2)] underline-offset-4 hover:underline"
        >
          inspect the source ↗
        </Link>
      </div>
    </motion.div>
  )
}
