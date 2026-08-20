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
 *
 * Registering a task here is not enough to make it run — see
 * src/lib/cron-arm.ts and its use in worker.ts for the arming that actually
 * schedules the first alarm.
 */

import type { CronTask } from 'deepspace/worker'
import { buildCronContext } from 'deepspace/worker'
import type { Env } from '../worker.js'
import type { Game } from './lib/types'

export const tasks: CronTask[] = [
  { name: 'close-expired-assignments', intervalMinutes: 5 },
]

/**
 * How many games a single tick may close.
 *
 * In steady state a tick closes zero to a handful of games and never comes
 * near this. It exists for the *first* tick after arming, which meets every
 * assignment that expired while the task was dead — potentially every one the
 * app has ever hosted.
 *
 * Without a cap that tick issues one DO subrequest per game with no upper
 * bound. If the backlog ever exceeded the per-invocation subrequest budget the
 * tail of the loop would fail, and because the next tick restarts from the top
 * of the same unsorted list it would fail in exactly the same place — a task
 * that burns a tick every 5 minutes forever and never finishes draining.
 *
 * Capping plus oldest-deadline-first turns that into guaranteed forward
 * progress: each tick closes the 100 most overdue games and permanently
 * removes them from the candidate set, so any backlog drains at 1,200/hour and
 * the steady state is untouched.
 */
const MAX_CLOSES_PER_TICK = 100

/**
 * The assignment games a tick should close, oldest deadline first, capped.
 *
 * Pure and separated from the IO so the backlog behaviour is unit-testable:
 * this is the half that decides how a months-long backlog is handled.
 */
export function selectExpiredAssignments<T extends { recordId: string; data: Game }>(
  games: T[],
  now: number,
  limit: number = MAX_CLOSES_PER_TICK,
): T[] {
  return games
    .filter((g) => g.data.state !== 'ended')
    .filter((g) => Boolean(g.data.deadlineAt) && g.data.deadlineAt <= now)
    .sort((a, b) => a.data.deadlineAt - b.data.deadlineAt)
    .slice(0, limit)
}

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
  const due = selectExpiredAssignments(games, Date.now())
  for (const g of due) {
    try {
      await ctx.records.update('games', g.recordId, {
        ...g.data,
        state: 'ended',
        // The deadline, not `Date.now()`. An assignment is already closed at
        // its deadline — joinGame and submitAnswer both reject past it — so
        // this task is only catching the state flag up to a fact that is
        // already true. Stamping the current time would be accurate enough on
        // a healthy 5-minute cadence but a fabrication on a backlog: a game
        // that expired in June would report as having ended today, sort to the
        // top of the reports list ahead of genuinely recent games, and hand
        // its CSV export today's date. `endedAt` feeds nothing but reporting
        // (sort key, "played X ago", export filename), and the truthful value
        // for all of them is when the assignment actually stopped accepting
        // work. Guaranteed non-zero and in the past — selectExpiredAssignments
        // filters out anything else.
        endedAt: g.data.deadlineAt,
      })
    } catch (err) {
      console.error('[cron] close-expired-assignments update failed', {
        gameId: g.recordId,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }
}
