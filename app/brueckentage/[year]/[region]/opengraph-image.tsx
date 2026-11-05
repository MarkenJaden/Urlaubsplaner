import { ImageResponse } from 'next/og'
import { getSeoRegionBySlug, isValidSeoYear } from '@/lib/seo-regions'

export const alt = 'Brückentage & Schulferien im Urlaubsplaner'
export const size = {
  width: 1200,
  height: 630,
}
export const contentType = 'image/png'

export default async function RegionOpenGraphImage({
  params,
}: {
  params: Promise<{ year: string; region: string }>
}) {
  const { year: yearStr, region: regionSlug } = await params
  const year = Number(yearStr)
  const region = getSeoRegionBySlug(regionSlug)

  const regionTitle = region ? region.name : 'Alle Bundesländer'
  const displayYear = isValidSeoYear(year) ? String(year) : ''
  const highlight =
    region?.highlight ??
    'Maximale freie Tage durch smarte Kombination aus gesetzlichen Feiertagen, Wochenenden und Schulferien.'

  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '56px 64px',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 52%, #0f3d3e 100%)',
          color: '#f8fafc',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '14px',
                background: 'linear-gradient(135deg, #2563eb 0%, #10b981 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '26px',
                fontWeight: 800,
                color: '#ffffff',
              }}
            >
              U
            </div>
            <span style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '-0.02em' }}>
              urlaubsplaner.me
            </span>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '8px 18px',
              borderRadius: '999px',
              background: 'rgba(56, 189, 248, 0.18)',
              border: '1px solid rgba(56, 189, 248, 0.45)',
              color: '#bae6fd',
              fontSize: '18px',
              fontWeight: 600,
            }}
          >
            Kostenlos &amp; ohne Anmeldung
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', maxWidth: '1050px' }}>
          <div
            style={{
              fontSize: '58px',
              fontWeight: 800,
              lineHeight: 1.12,
              letterSpacing: '-0.03em',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <span>Brückentage {displayYear}</span>
            <span style={{ color: '#38bdf8' }}>{regionTitle}</span>
          </div>

          <div
            style={{
              fontSize: '24px',
              color: '#cbd5e1',
              lineHeight: 1.4,
              maxWidth: '940px',
            }}
          >
            {highlight}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            width: '100%',
            paddingTop: '22px',
            borderTop: '1px solid rgba(148, 163, 184, 0.25)',
          }}
        >
          <div
            style={{
              display: 'flex',
              padding: '10px 18px',
              borderRadius: '12px',
              background: 'rgba(16, 185, 129, 0.16)',
              border: '1px solid rgba(16, 185, 129, 0.35)',
              color: '#d1fae5',
              fontSize: '18px',
              fontWeight: 600,
            }}
          >
            Alle Feiertage &amp; Schulferien {displayYear}
          </div>
          <div
            style={{
              display: 'flex',
              padding: '10px 18px',
              borderRadius: '12px',
              background: 'rgba(168, 85, 247, 0.16)',
              border: '1px solid rgba(168, 85, 247, 0.35)',
              color: '#f3e8ff',
              fontSize: '18px',
              fontWeight: 600,
            }}
          >
            Direkt interaktiv im Kalender öffnen
          </div>
        </div>
      </div>
    ),
    { ...size },
  )
}
