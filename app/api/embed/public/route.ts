import { NextResponse } from 'next/server'
import { fetchPublicWidgetData } from '@/lib/public-widget-data'
import { isValidSeoYear } from '@/lib/seo-regions'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const yearParam = Number(searchParams.get('year') ?? String(new Date().getFullYear()))
  const year =
    Number.isInteger(yearParam) && (isValidSeoYear(yearParam) || (yearParam >= 2024 && yearParam <= 2035))
      ? yearParam
      : new Date().getFullYear()

  const region = searchParams.get('region') ?? 'de'
  const includeHeatmap = searchParams.get('includeHeatmap') === '1'

  try {
    const payload = await fetchPublicWidgetData({
      year,
      regionSlug: region,
      includeHeatmap,
    })
    return NextResponse.json(payload, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    })
  } catch {
    return NextResponse.json(
      { error: 'Öffentliche Kalenderdaten konnten nicht geladen werden.' },
      { status: 502 },
    )
  }
}
