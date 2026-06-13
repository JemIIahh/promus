import { Navbar } from '@/components/Navbar'
import { Footer } from '@/components/Footer'
import { Hero } from '@/components/sections/Hero'
import { V1Opener } from '@/components/sections/section2/V1Opener'

export const metadata = {
  title: 'Promus · sovereign AI agents on Arbitrum',
  description:
    'Identity is an ERC-7857 iNFT on Arbitrum, memory is encrypted on IPFS, the brain is Claude, and the wallet is sealed to the token. Run promus init once; close the laptop, the agent survives.',
}

export default function LandingPage() {
  return (
    <main className="relative min-h-screen bg-[var(--color-cream)] text-[var(--color-ink)]">
      <Navbar />
      <Hero />
      <V1Opener />
      <Footer />
    </main>
  )
}
