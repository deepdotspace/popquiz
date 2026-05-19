import type { CollectionSchema } from 'deepspace/worker'

/**
 * One row per (player, question) submitted answer. Server action computes
 * `correct` and `pointsAwarded` authoritatively before insert — clients
 * cannot tamper with their own scoring.
 *
 * `optionIndex` = -1 when the question type isn't MCQ/poll/true_false.
 */
export const answersSchema: CollectionSchema = {
  name: 'answers',
  columns: [
    { name: 'gameId', storage: 'text', interpretation: 'plain', required: true },
    { name: 'playerId', storage: 'text', interpretation: 'plain', required: true },
    { name: 'userId', storage: 'text', interpretation: 'plain', required: true, userBound: true, immutable: true },
    { name: 'questionIndex', storage: 'number', interpretation: 'plain', required: true },
    { name: 'optionIndex', storage: 'number', interpretation: 'plain', default: -1 },
    { name: 'textAnswer', storage: 'text', interpretation: 'plain', default: '' },
    { name: 'numberAnswer', storage: 'number', interpretation: 'plain', default: 0 },
    { name: 'correct', storage: 'number', interpretation: 'plain', default: 0 },
    { name: 'responseTimeMs', storage: 'number', interpretation: 'plain', default: 0 },
    { name: 'pointsAwarded', storage: 'number', interpretation: 'plain', default: 0 },
  ],
  ownerField: 'userId',
  permissions: {
    viewer: { read: true, create: true, update: false, delete: false },
    member: { read: true, create: true, update: false, delete: false },
    admin: { read: true, create: true, update: true, delete: true },
  },
}
