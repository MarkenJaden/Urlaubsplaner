import { PrismaClient } from '@prisma/client'
import { spawnSync } from 'node:child_process'

const prisma = new PrismaClient()
const baseline = '20261007000000_baseline'
function command(args) {
  const result = spawnSync(process.execPath, ['node_modules/prisma/build/index.js', ...args], { stdio: 'inherit' })
  if (result.status !== 0) throw new Error('Migration command failed')
}

try {
  const rows = await prisma.$queryRaw`SELECT table_name, column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema = 'public' AND table_name IN ('User', 'VacationEntry')`
  if (rows.length) {
    const required = { User: ['id', 'keycloakId', 'email', 'name', 'calendarToken', 'preferences', 'createdAt', 'updatedAt'], VacationEntry: ['id', 'userId', 'date', 'type', 'title', 'year', 'createdAt', 'updatedAt'] }
    for (const [table, columns] of Object.entries(required)) {
      if (columns.some(column => !rows.some(row => row.table_name === table && row.column_name === column && row.data_type === (column === 'preferences' ? 'jsonb' : column === 'year' ? 'integer' : ['date', 'createdAt', 'updatedAt'].includes(column) ? 'timestamp without time zone' : 'text') && row.is_nullable === (['email', 'name', 'title'].includes(column) ? 'YES' : 'NO')))) throw new Error('Existing database does not match the expected legacy schema; refusing to baseline')
    }
    const [exists] = await prisma.$queryRaw`SELECT to_regclass('public._prisma_migrations') IS NOT NULL AS present`
    const applied = exists.present ? await prisma.$queryRaw`SELECT migration_name FROM "_prisma_migrations" WHERE migration_name = ${baseline} AND finished_at IS NOT NULL AND rolled_back_at IS NULL` : []
    if (!applied.length) command(['migrate', 'resolve', '--applied', baseline])
  }
  command(['migrate', 'deploy'])
} catch (error) {
  console.error(error.message === 'Existing database does not match the expected legacy schema; refusing to baseline' ? error.message : 'Database migration failed; application startup stopped.')
  process.exitCode = 1
} finally {
  await prisma.$disconnect()
}
