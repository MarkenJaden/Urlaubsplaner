import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'

const base = process.env.TEST_BASE_URL ?? 'http://127.0.0.1:3107'
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname), 'Integration tests must only target a local test instance')
const username = `test.${randomUUID().slice(0, 8)}`
const password = 'Synthetic test passphrase 2026!'
const newPassword = 'Synthetic recovered passphrase 2026!'
let checks = 0
function check(condition, message) { assert.ok(condition, message); checks++ }

function client() {
  const cookies = new Map()
  return async (path, options = {}) => {
    const response = await fetch(`${base}${path}`, { redirect: 'manual', ...options, headers: { Origin: base, Cookie: [...cookies].map(([key, value]) => `${key}=${value}`).join('; '), ...options.headers } })
    for (const cookie of response.headers.getSetCookie()) { const [pair] = cookie.split(';'); const split = pair.indexOf('='); cookies.set(pair.slice(0, split), pair.slice(split + 1)) }
    return response
  }
}
const json = (body, method = 'POST') => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
async function login(request, pass = password) {
  const { csrfToken } = await (await request('/api/auth/csrf')).json()
  const response = await request('/api/auth/callback/credentials', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Auth-Return-Redirect': '1' }, body: new URLSearchParams({ username, password: pass, csrfToken, callbackUrl: base }) })
  check(response.status === 200, 'Auth.js callback succeeds')
  const session = await (await request('/api/auth/session')).json()
  check(Boolean(session.user?.id), 'Authenticated session has an app user ID')
}

const deviceA = client(), deviceB = client(), guest = client()
const registration = await guest('/api/account/register', json({ username, password }))
check(registration.status === 201, 'Local registration succeeds')
let { recoveryKey } = await registration.json()
check(typeof recoveryKey === 'string' && recoveryKey.length === 43, 'Recovery key is issued once')
check((await guest('/api/account/register', json({ username, password }))).status === 409, 'Duplicate account is rejected')
check((await guest('/api/account/register', { ...json({ username: `${username}.x`, password }), headers: { 'Content-Type': 'application/json', Origin: 'https://foreign.example' } })).status === 403, 'Foreign-origin mutation is rejected')
check((await guest('/api/vacations', json({ date: '2026-12-31', type: 'vacation' }))).status === 401, 'Guest cannot mutate stored plans')
await login(deviceA); await login(deviceB)
let profile = await (await deviceA('/api/profile')).json()
check(profile.username === username && profile.hasLocalAccount, 'Profile exposes account state without credential hashes')
check(!('passwordHash' in profile) && !('recoveryHash' in profile), 'Credential hashes never leave the server')
const patches = await Promise.all([
  deviceA('/api/profile', json({ preferences: { subdivision: 'DE-NW', vacationDaysPerYear: { 2026: 25 } } }, 'PATCH')),
  deviceB('/api/profile', json({ preferences: { vacationDaysPerYear: { 2027: 28 } } }, 'PATCH')),
])
check(patches.every(response => response.ok), 'Concurrent preference writes succeed')
profile = await (await deviceB('/api/profile')).json()
check(profile.preferences.subdivision === 'DE-NW' && profile.preferences.vacationDaysPerYear[2026] === 25 && profile.preferences.vacationDaysPerYear[2027] === 28, 'Both devices observe merged per-year preferences')
check((await deviceA('/api/profile', json({ preferences: { admin: true } }, 'PATCH'))).status === 400, 'Unknown preferences are rejected')
check((await deviceA('/api/vacations', json({ date: '2026-02-30', type: 'vacation' }))).status === 400, 'Impossible date is rejected')
const entryResponse = await deviceA('/api/vacations', json({ date: '2026-12-31', type: 'vacation', title: 'Synthetic holiday' }))
check(entryResponse.ok, 'Vacation is stored')
const entry = await entryResponse.json()
await deviceA('/api/vacations', json({ date: '2026-12-31', type: 'vacation', title: 'Synthetic holiday' }))
let entries = await (await deviceB('/api/vacations?year=2026')).json()
check(entries.length === 1 && entries[0].id === entry.id, 'Repeated writes are idempotent and visible on the second device')
const importBody = { vacations: [{ date: '2026-12-30', type: 'gleittag' }, { date: '2026-12-31', type: 'vacation', title: 'Must not overwrite' }] }
check((await deviceA('/api/vacations/import', json(importBody))).ok, 'Guest plan import succeeds')
check((await deviceA('/api/vacations/import', json(importBody))).ok, 'Guest plan reimport succeeds')
entries = await (await deviceB('/api/vacations?year=2026')).json()
check(entries.length === 2 && entries.find(e => e.id === entry.id)?.title === 'Synthetic holiday', 'Import does not duplicate or overwrite saved entries')
const oldToken = profile.calendarToken
let feedResponse = await guest(`/api/calendar/${oldToken}/feed.ics`)
check(feedResponse.ok && feedResponse.headers.get('content-type')?.includes('text/calendar'), 'Calendar feed works without any session')
const feed = await feedResponse.text()
check(feed.includes('DTEND;VALUE=DATE:20270101'), 'Calendar keeps the exclusive next-day end')
check(feed === await (await guest(`/api/calendar/${oldToken}/feed.ics`)).text(), 'Repeated subscription fetches preserve stable IDs and timestamps')
check((await deviceA(`/api/vacations/${entry.id}`, { method: 'DELETE' })).ok, 'Vacation deletion succeeds')
check(!(await (await guest(`/api/calendar/${oldToken}/feed.ics`)).text()).includes('Synthetic holiday'), 'Deleted entries disappear from the subscription')
const rotation = await deviceA('/api/calendar/token', { method: 'POST' })
check(rotation.ok, 'Subscription token rotation succeeds')
const { calendarToken } = await rotation.json()
check((await guest(`/api/calendar/${oldToken}/feed.ics`)).status === 404, 'Old subscription token is revoked')
check((await guest(`/api/calendar/${calendarToken}/feed.ics`)).ok, 'New subscription token works')
const subdivisions = await (await guest('/api/subdivisions?country=DE')).json()
check(Array.isArray(subdivisions) && subdivisions.length === 16, 'All 16 federal states are available')
const holidayResponses = await Promise.all(subdivisions.map(state => guest(`/api/holidays?country=DE&subdivision=${state.code}&year=2026&type=school`)))
check(holidayResponses.every(response => response.ok), 'School holidays load for all 16 states')
const holidays = await Promise.all(holidayResponses.map(response => response.json()))
check(holidays.every(list => Array.isArray(list) && list.length > 0 && list.every(item => item.startDate >= '2026-01-01' && item.endDate <= '2026-12-31')), 'All states have correctly clipped holiday intervals')
check((await deviceA('/api/profile', json({ preferences: { feedIncludePublicHolidays: true, feedIncludeSchoolHolidays: true } }, 'PATCH'))).ok, 'Subscription holiday filters can be enabled')
const holidayFeed = await guest(`/api/calendar/${calendarToken}/feed.ics`)
check(holidayFeed.ok, 'Holiday-inclusive subscription is available')
const holidayContent = await holidayFeed.text()
check(holidayContent.includes('SUMMARY:Schulferien') && holidayContent.includes('SUMMARY:Feiertag'), 'Subscription includes school and public holidays')
const recovery = await guest('/api/account/recover', json({ username, recoveryKey, password: newPassword }))
check(recovery.ok, 'Recovery succeeds with the recovery key')
const previousKey = recoveryKey
recoveryKey = (await recovery.json()).recoveryKey
check(recoveryKey !== previousKey, 'Recovery rotates the recovery key')
check((await deviceA('/api/profile')).status === 401 && (await deviceB('/api/profile')).status === 401, 'Recovery revokes sessions on both devices')
check((await guest('/api/account/recover', json({ username, recoveryKey: previousKey, password: newPassword }))).status === 400, 'Previous recovery key cannot be reused')
const recovered = client(); await login(recovered, newPassword)
check((await recovered('/api/vacations?year=2026')).ok, 'Existing plan remains accessible after recovery')
check((await recovered('/api/account', json({ password: newPassword, confirmation: 'DELETE' }, 'DELETE'))).ok, 'Owner can explicitly delete their account')
check((await recovered('/api/profile')).status === 401, 'Deleted account cannot use its session')
check((await guest(`/api/calendar/${calendarToken}/feed.ics`)).status === 404, 'Deleted account subscription is revoked')
console.log(`Integration checks passed: ${checks}; synthetic account deleted. No credentials or subscription tokens printed.`)
