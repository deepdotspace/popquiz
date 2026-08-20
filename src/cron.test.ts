/**
 * close-expired-assignments has never run. The tick that arms it is therefore
 * the first one ever, and it meets every assignment that expired while the
 * task was dead. These assertions cover that first tick, not the steady state.
 */

import { describe, it, expect } from 'vitest'
import { selectExpiredAssignments } from './cron'
import type { Game } from './lib/types'

const DAY = 24 * 60 * 60 * 1000
const NOW = 1_760_000_000_000

function game(recordId: string, over: Partial<Game>): { recordId: string; data: Game } {
  return {
    recordId,
    data: {
      pin: '123456',
      quizId: 'q1',
      hostId: 'u1',
      mode: 'assignment',
      state: 'lobby',
      currentQuestionIndex: 0,
      currentQuestionStartedAt: 0,
      scoringMode: 'standard',
      streakBonusEnabled: 1,
      nicknameGeneratorEnabled: 1,
      teamMode: 0,
      deadlineAt: 0,
      endedAt: 0,
      ...over,
    },
  }
}

describe('selectExpiredAssignments (what the first tick after arming touches)', () => {
  it('selects an assignment whose deadline has passed', () => {
    const due = selectExpiredAssignments([game('a', { deadlineAt: NOW - DAY })], NOW)
    expect(due.map((g) => g.recordId)).toEqual(['a'])
  })

  it('leaves games whose deadline is still in the future alone', () => {
    expect(selectExpiredAssignments([game('a', { deadlineAt: NOW + DAY })], NOW)).toEqual([])
  })

  it('leaves games with no deadline alone', () => {
    // deadlineAt defaults to 0 — a live game, or an assignment with no due
    // date. Neither should ever be auto-closed.
    expect(selectExpiredAssignments([game('a', { deadlineAt: 0 })], NOW)).toEqual([])
  })

  // Idempotence is what stops the backlog from being re-walked every 5 minutes
  // forever: once closed, a game leaves the candidate set permanently.
  it('never re-selects a game it has already ended', () => {
    const closed = game('a', { deadlineAt: NOW - DAY, state: 'ended', endedAt: NOW - DAY })
    expect(selectExpiredAssignments([closed], NOW)).toEqual([])
  })

  it('caps a months-long backlog instead of updating every row in one tick', () => {
    const backlog = Array.from({ length: 250 }, (_, i) =>
      game(`g${i}`, { deadlineAt: NOW - (i + 1) * DAY }),
    )
    expect(selectExpiredAssignments(backlog, NOW)).toHaveLength(100)
  })

  // Oldest-first is what makes the drain terminate. An arbitrary 100 could
  // return the same 100 rows every tick if any of them kept failing to write;
  // chronological order means each tick starts where the last one stopped.
  it('drains the backlog oldest deadline first', () => {
    const backlog = [
      game('recent', { deadlineAt: NOW - DAY }),
      game('ancient', { deadlineAt: NOW - 90 * DAY }),
      game('older', { deadlineAt: NOW - 30 * DAY }),
    ]
    expect(selectExpiredAssignments(backlog, NOW).map((g) => g.recordId)).toEqual([
      'ancient',
      'older',
      'recent',
    ])
  })

  it('makes forward progress: a capped backlog fully drains over successive ticks', () => {
    let backlog = Array.from({ length: 25 }, (_, i) =>
      game(`g${i}`, { deadlineAt: NOW - (i + 1) * DAY }),
    )
    let ticks = 0
    for (;;) {
      const due = selectExpiredAssignments(backlog, NOW, 10)
      if (due.length === 0) break
      const closing = new Set(due.map((g) => g.recordId))
      backlog = backlog.map((g) =>
        closing.has(g.recordId)
          ? game(g.recordId, { ...g.data, state: 'ended', endedAt: g.data.deadlineAt })
          : g,
      )
      ticks++
      expect(ticks).toBeLessThan(10) // must terminate, not spin
    }
    expect(ticks).toBe(3)
    expect(backlog.every((g) => g.data.state === 'ended')).toBe(true)
  })

  it('closes a game at its deadline, not at the moment the backlog is drained', () => {
    // The value the task writes as endedAt. Stamping Date.now() would report a
    // June assignment as having ended the day arming happened.
    const expired = game('a', { deadlineAt: NOW - 60 * DAY })
    const [due] = selectExpiredAssignments([expired], NOW)
    expect(due.data.deadlineAt).toBe(NOW - 60 * DAY)
    expect(due.data.deadlineAt).toBeLessThan(NOW)
    expect(due.data.deadlineAt).not.toBe(0)
  })

  it('handles an empty collection', () => {
    expect(selectExpiredAssignments([], NOW)).toEqual([])
  })
})
