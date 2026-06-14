'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import type { CSSProperties } from 'react'
import { InteractiveScreen } from './InteractiveScreen'

/**
 * Cinematic hero: a Locomotive-style studio gradient (tinted with color
 * variation, not flat grey) with the interactive Three.js motion screen as the
 * dominant centerpiece. Minimal copy — the motion does the talking.
 */
export function HeroScreen() {
  return (
    <section
      id="hero"
      // The cinematic gradient is always light, so pin the theme tokens to their
      // LIGHT values inside the hero — otherwise dark mode flips text to cream
      // and it vanishes on the light gradient.
      style={
        {
          '--color-ink': '#100f09',
          '--color-ink-2': '#525251',
          '--color-ink-3': '#8b8b88',
          '--color-cream': '#f9f8f6',
        } as CSSProperties
      }
      className="relative isolate flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 pt-28 pb-20 text-center sm:px-8"
    >
      {/* neutral studio grey — Locomotive grade, no color washes */}
      <div
        aria-hidden
        className="absolute inset-0 -z-20"
        style={{
          background:
            'radial-gradient(120% 92% at 50% -8%, #eeeef1 0%, #e4e5e8 42%, #d7d8dc 78%, #cdced3 100%)',
        }}
      />
      {/* soft neutral depth — light top, faint grey floor (no hue) */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(70% 52% at 50% 4%, rgba(255,255,255,0.55), transparent 56%), radial-gradient(120% 85% at 50% 122%, rgba(116,120,130,0.20), transparent 62%)',
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.05 }}
        className="kicker mb-7"
      >
        <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[#3aa66e] motion-reduce:animate-none" />
        sovereign agents on arbitrum
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.85, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
        className="font-grotesk max-w-[20ch] text-[clamp(32px,5vw,68px)] font-medium leading-[1.04] tracking-[-0.03em] text-[var(--color-ink)]"
      >
        A sovereign agent, alive on its own.
      </motion.h1>

      {/* the motion screen — the centerpiece */}
      <motion.div
        initial={{ opacity: 0, y: 28, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 1.1, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="mt-12 w-full max-w-[1080px]"
      >
        <InteractiveScreen />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="mt-11 flex items-center gap-3"
      >
        <Link
          href="/docs/02-quickstart"
          className="font-grotesk group inline-flex items-center gap-2 rounded-full bg-[var(--color-ink)] px-7 py-3.5 text-[14.5px] font-medium text-[var(--color-cream)] shadow-[0_20px_44px_-22px_rgba(16,15,9,0.7)] outline-none transition-transform hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-[var(--color-ink)]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
        >
          Run an agent
          <span aria-hidden className="transition-transform group-hover:translate-x-1">
            →
          </span>
        </Link>
        <Link
          href="/docs"
          className="font-grotesk rounded-full px-5 py-3.5 text-[14.5px] font-medium text-[var(--color-ink-2)] outline-none transition-colors hover:text-[var(--color-ink)] focus-visible:ring-2 focus-visible:ring-[var(--color-ink)]/30"
        >
          Read the docs
        </Link>
      </motion.div>
    </section>
  )
}
