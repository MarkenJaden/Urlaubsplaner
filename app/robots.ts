import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXTAUTH_URL || 'https://urlaubsplaner.me'
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/admin', '/settings'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
