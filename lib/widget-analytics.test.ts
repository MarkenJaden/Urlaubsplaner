import { describe, it, expect } from 'vitest'
import { extractEmbedHost } from '@/lib/widget-analytics'

describe('extractEmbedHost (GDPR-compliant widget analytics)', () => {
  it('returns "direct" when referer is missing, empty, or malformed', () => {
    expect(extractEmbedHost(undefined)).toBe('direct')
    expect(extractEmbedHost(null)).toBe('direct')
    expect(extractEmbedHost('')).toBe('direct')
    expect(extractEmbedHost('   ')).toBe('direct')
    expect(extractEmbedHost('not-a-valid-url')).toBe('direct')
  })

  it('strips paths, query strings, hashes, userinfo, ports, and www prefix', () => {
    expect(
      extractEmbedHost(
        'https://user:secret@www.Beispiel-Firma.de:8443/intranet/urlaub?token=abc&user=max#section',
      ),
    ).toBe('beispiel-firma.de')
  })

  it('returns "self" when referer host matches selfHost (ignoring port & www)', () => {
    expect(
      extractEmbedHost('https://www.urlaubsplaner.me/widget?mode=heatmap', 'urlaubsplaner.me:443'),
    ).toBe('self')
    expect(
      extractEmbedHost('http://localhost:3000/widget', 'localhost:3000'),
    ).toBe('self')
  })

  it('redacts raw IPv4 and IPv6 literals so no IP address is persisted', () => {
    expect(extractEmbedHost('http://192.168.1.42:8080/dashboard')).toBe('ip-redacted')
    expect(extractEmbedHost('http://[2001:db8::1]/calendar')).toBe('ip-redacted')
  })

  it('returns "other" for non-HTTP(S) schemes', () => {
    expect(extractEmbedHost('javascript:alert(1)')).toBe('other')
    expect(extractEmbedHost('file:///Users/alice/index.html')).toBe('other')
  })
})
