/**
 * Server-authoritative scoring. Used inside server actions on submit.
 *
 * Standard mode (the classic default): points scale with response speed.
 *   formula: round((1 - (responseTime / timeLimit) / 2) * MAX) on correct.
 *   Sub-0.5s correct ≈ MAX. Half-time correct ≈ 75% of MAX.
 *
 * Accuracy mode: flat MAX on correct, 0 otherwise. For younger learners.
 *
 * Streak bonus: when enabled, +100 / +200 / +300 / +400 / +500 (capped) on
 * 2nd / 3rd / 4th / 5th / 6th+ correct in a row. Applied on top of the base.
 */

export const MAX_POINTS = 1000

export type ScoringMode = 'standard' | 'accuracy'

export interface ScoreInput {
  correct: boolean
  responseTimeMs: number
  timeLimitSec: number
  scoringMode: ScoringMode
  streakAfter: number  // streak count *after* this answer (so 1 = first correct, 2 = second-in-row, etc.)
  streakBonusEnabled: boolean
}

export function computeScore(input: ScoreInput): number {
  if (!input.correct) return 0

  const base = input.scoringMode === 'accuracy'
    ? MAX_POINTS
    : computeSpeedBonus(input.responseTimeMs, input.timeLimitSec)

  const streak = input.streakBonusEnabled ? streakBonus(input.streakAfter) : 0
  return base + streak
}

function computeSpeedBonus(responseTimeMs: number, timeLimitSec: number): number {
  if (timeLimitSec <= 0) return MAX_POINTS
  const ratio = Math.max(0, Math.min(1, responseTimeMs / (timeLimitSec * 1000)))
  return Math.round((1 - ratio / 2) * MAX_POINTS)
}

/** 0 for streak < 2, then +100 per additional correct, capped at +500. */
function streakBonus(streakAfter: number): number {
  if (streakAfter < 2) return 0
  return Math.min(500, (streakAfter - 1) * 100)
}
