import { Footer } from '@/components/Footer'
import { Navbar } from '@/components/Navbar'
import { HeroScreen } from '@/components/sections/HeroScreen'
import { InteractiveNarrative } from '@/components/sections/InteractiveNarrative'
import { Section4 } from '@/components/sections/Section4'

export const metadata = {
  title: 'Promus · sovereign AI agents on Arbitrum',
  description:
    'Identity is an ERC-7857 iNFT on Arbitrum, memory is encrypted on IPFS, the brain is Claude, and the wallet is sealed to the token. Run promus init once; close the laptop, the agent survives.',
}

export default function LandingPage() {
  return (
    <main className="landing-light relative min-h-screen bg-[#e7e8eb] text-[var(--color-ink)]">
      <Navbar />

      {/* 1 · cinematic hero — gradient + interactive screen (click to start → live chat) */}
      <HeroScreen />

      {/* 2 · the narrative — click a topic, the agent types its answer */}
      <InteractiveNarrative />

      {/* 4 · closing CTA */}
      <Section4 />

      <Footer />
    </main>
  )
}
