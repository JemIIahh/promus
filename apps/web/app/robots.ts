import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/' }],
    // TODO: real domain — promus.dev is a placeholder; the domain is not yet owned.
    host: 'https://promus.dev',
  }
}
