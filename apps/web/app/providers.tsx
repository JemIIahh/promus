'use client'

import type { ReactNode } from 'react'

// The landing + docs site has no wallet, SIWE, or data-fetching needs — those
// belonged to the operator console, which has been retired. This is kept as a
// thin passthrough so app/layout.tsx can keep wrapping children in <Providers>
// without churn if client-side providers are reintroduced later. The theme
// provider lives in app/layout.tsx (ThemeProvider), one level up.
export function Providers({ children }: { children: ReactNode }) {
  return <>{children}</>
}
