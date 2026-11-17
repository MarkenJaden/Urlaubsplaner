import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  planShareFindUnique: vi.fn(),
  planShareFindMany: vi.fn(),
}))

vi.mock('@/auth', () => ({ auth: mocks.auth }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    planShare: {
      findUnique: mocks.planShareFindUnique,
      findMany: mocks.planShareFindMany,
    },
  },
}))

const { GET } = await import('@/app/api/shares/[token]/route')
const { stripOwnShareOverlays } = await import('@/lib/user')

const validToken = 'a'.repeat(24)

afterEach(() => {
  mocks.auth.mockReset()
  mocks.planShareFindUnique.mockReset()
  mocks.planShareFindMany.mockReset()
})

describe('GET /api/shares/[token]', () => {
  it('blocks a signed-in owner from loading their own share as a foreign overlay', async () => {
    mocks.auth.mockResolvedValue({ user: { id: 'user-1' } })
    mocks.planShareFindUnique.mockResolvedValue({
      id: 'share-1',
      userId: 'user-1',
      token: validToken,
      label: 'Mein Plan',
      color: '#10b981',
      permission: 'view',
      includeNotes: false,
      updatedAt: new Date('2026-06-01T10:00:00Z'),
      user: {
        name: 'Jan',
        username: 'jan',
        updatedAt: new Date('2026-06-01T10:00:00Z'),
        preferences: {},
        vacations: [],
      },
    })

    const res = await GET(new Request(`http://localhost/api/shares/${validToken}`), {
      params: Promise.resolve({ token: validToken }),
    })
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.code).toBe('SELF_SHARE')
    expect(body.isOwner).toBe(true)
  })

  it('allows another user to load the shared plan', async () => {
    mocks.auth.mockResolvedValue({ user: { id: 'user-2' } })
    mocks.planShareFindUnique.mockResolvedValue({
      id: 'share-1',
      userId: 'user-1',
      token: validToken,
      label: 'Jans Plan',
      color: '#10b981',
      permission: 'view',
      includeNotes: false,
      updatedAt: new Date('2026-06-01T10:00:00Z'),
      user: {
        name: 'Jan',
        username: 'jan',
        updatedAt: new Date('2026-06-01T10:00:00Z'),
        preferences: {},
        vacations: [],
      },
    })

    const res = await GET(new Request(`http://localhost/api/shares/${validToken}`), {
      params: Promise.resolve({ token: validToken }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.token).toBe(validToken)
  })
})

describe('stripOwnShareOverlays', () => {
  it('removes overlays whose token belongs to the user while keeping foreign overlays', async () => {
    mocks.planShareFindMany.mockResolvedValue([{ token: 'own-token-1234567890123456' }])
    const result = await stripOwnShareOverlays('user-1', {
      sharedOverlays: [
        {
          id: 'token-own',
          token: 'own-token-1234567890123456',
          label: 'Eigener Plan',
          color: '#10b981',
          enabled: true,
          permission: 'view',
          entries: [],
        },
        {
          id: 'token-partner',
          token: 'partner-token-1234567890123',
          label: 'Partner Plan',
          color: '#06b6d4',
          enabled: true,
          permission: 'view',
          entries: [],
        },
      ],
    })

    expect(result.changed).toBe(true)
    expect(result.preferences.sharedOverlays).toHaveLength(1)
    expect(result.preferences.sharedOverlays?.[0]?.id).toBe('token-partner')
  })
})
