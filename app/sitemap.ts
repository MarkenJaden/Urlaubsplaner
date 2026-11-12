import type { MetadataRoute } from 'next'
import { SEO_REGIONS, getSeoPlanningYears } from '@/lib/seo-regions'

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXTAUTH_URL || 'https://urlaubsplaner.me'
  const lastModified = new Date()
  const years = getSeoPlanningYears(lastModified)

  const yearEntries: MetadataRoute.Sitemap = years.map((year, idx) => ({
    url: `${baseUrl}/brueckentage/${year}`,
    lastModified,
    changeFrequency: 'weekly',
    priority: idx <= 1 ? 0.9 : 0.8,
  }))

  const regionEntries: MetadataRoute.Sitemap = years.flatMap((year, idx) =>
    SEO_REGIONS.map(region => ({
      url: `${baseUrl}/brueckentage/${year}/${region.slug}`,
      lastModified,
      changeFrequency: 'weekly' as const,
      priority: idx <= 1 ? 0.85 : 0.75,
    }))
  )

  const deRegions = SEO_REGIONS.filter(r => r.country === 'DE')
  const schoolYearEntries: MetadataRoute.Sitemap = years.map((year, idx) => ({
    url: `${baseUrl}/schulferien/${year}`,
    lastModified,
    changeFrequency: 'weekly' as const,
    priority: idx <= 1 ? 0.88 : 0.78,
  }))

  const schoolRegionEntries: MetadataRoute.Sitemap = years.flatMap((year, idx) =>
    deRegions.map(region => ({
      url: `${baseUrl}/schulferien/${year}/${region.slug}`,
      lastModified,
      changeFrequency: 'weekly' as const,
      priority: idx <= 1 ? 0.82 : 0.72,
    }))
  )

  return [
    {
      url: baseUrl,
      lastModified,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${baseUrl}/brueckentage`,
      lastModified,
      changeFrequency: 'weekly',
      priority: 0.95,
    },
    {
      url: `${baseUrl}/schulferien`,
      lastModified,
      changeFrequency: 'weekly',
      priority: 0.92,
    },
    {
      url: `${baseUrl}/widget`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    ...yearEntries,
    ...regionEntries,
    ...schoolYearEntries,
    ...schoolRegionEntries,
    {
      url: `${baseUrl}/kontakt`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/impressum`,
      lastModified,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/datenschutz`,
      lastModified,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ]
}
