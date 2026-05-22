/**
 * Cron tasks — registered into the AppCronRoom DO at construction time
 * (worker.ts). The DO alarm fires `runTask(name, env)` on the declared
 * schedule.
 *
 * Tasks declare EITHER `intervalMinutes` OR `schedule` + `timezone`.
 *
 *   close-expired-assignments — every 5m. Walks all assignment-mode games
 *   whose `deadlineAt` has passed but are not yet `state === 'ended'`,
 *   and marks them ended so they stop accepting submissions and start
 *   appearing in reports with a real ended-at date instead of '—'.
 */

import type { CronTask } from 'deepspace/worker'
import { buildCronContext } from 'deepspace/worker'
import type { Env } from '../worker.js'
import type { Game } from './lib/types'

export const tasks: CronTask[] = [
  { name: 'close-expired-assignments', intervalMinutes: 5 },
]

export async function runTask(name: string, env: Env): Promise<void> {
  if (name === 'close-expired-assignments') {
    return closeExpiredAssignments(env)
  }
}

async function closeExpiredAssignments(env: Env): Promise<void> {
  const ctx = buildCronContext(env, env.OWNER_USER_ID, `app:${env.APP_NAME}`)
  const games = (await ctx.records.query('games', { where: { mode: 'assignment' } })) as Array<{
    recordId: string
    data: Game
  }>
  const now = Date.now()
  for (const g of games) {
    if (g.data.state === 'ended') continue
    if (!g.data.deadlineAt || g.data.deadlineAt > now) continue
    try {
      await ctx.records.update('games', g.recordId, {
        ...g.data,
        state: 'ended',
        endedAt: now,
      })
    } catch (err) {
      console.error('[cron] close-expired-assignments update failed', {
        gameId: g.recordId,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }
}
