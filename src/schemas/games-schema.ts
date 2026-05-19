import type { CollectionSchema } from 'deepspace/worker'

/**
 * Runtime game state. Mutated only via server actions for authoritative
 * scoring & state transitions. Anyone (including anonymous players) can
 * read so the join flow + lobby UI work without auth.
 *
 * states:
 *   lobby        — accepting joins, host hasn't pressed Start
 *   in_question  — current question shown, timer running
 *   reveal       — answer + distribution chart
 *   leaderboard  — top-5 between questions
 *   ended        — podium / final
 *
 * mode: 'live' (host-led) | 'assignment' (async, no host)
 */
export const gamesSchema: CollectionSchema = {
  name: 'games',
  columns: [
    { name: 'pin', storage: 'text', interpretation: 'plain', required: true },
    { name: 'quizId', storage: 'text', interpretation: 'plain', required: true },
    { name: 'hostId', storage: 'text', interpretation: 'plain', required: true, userBound: true, immutable: true },
    { name: 'mode', storage: 'text', interpretation: 'plain', default: 'live' },
    { name: 'state', storage: 'text', interpretation: 'plain', default: 'lobby' },
    { name: 'currentQuestionIndex', storage: 'number', interpretation: 'plain', default: 0 },
    { name: 'currentQuestionStartedAt', storage: 'number', interpretation: 'plain', default: 0 },
    { name: 'scoringMode', storage: 'text', interpretation: 'plain', default: 'standard' },
    { name: 'streakBonusEnabled', storage: 'number', interpretation: 'plain', default: 1 },
    { name: 'nicknameGeneratorEnabled', storage: 'number', interpretation: 'plain', default: 1 },
    { name: 'teamMode', storage: 'number', interpretation: 'plain', default: 0 },
    { name: 'deadlineAt', storage: 'number', interpretation: 'plain', default: 0 },
    { name: 'endedAt', storage: 'number', interpretation: 'plain', default: 0 },
  ],
  ownerField: 'hostId',
  permissions: {
    viewer: { read: true, create: false, update: false, delete: false },
    member: { read: true, create: true, update: 'own', delete: 'own' },
    admin: { read: true, create: true, update: true, delete: true },
  },
}
