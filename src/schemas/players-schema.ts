import type { CollectionSchema } from 'deepspace/worker'

/**
 * One row per player joined to a game. `userId` tracks the (possibly
 * anonymous) auth identity so the same person who opens a tab and refreshes
 * lands back on the same player record / score.
 *
 * `kicked` is a soft flag (number 0/1) so the row stays in reports but the
 * player's WS session is dropped from active gameplay.
 */
export const playersSchema: CollectionSchema = {
  name: 'players',
  columns: [
    { name: 'gameId', storage: 'text', interpretation: 'plain', required: true },
    { name: 'userId', storage: 'text', interpretation: 'plain', required: true, userBound: true, immutable: true },
    { name: 'nickname', storage: 'text', interpretation: 'plain', required: true },
    { name: 'teamName', storage: 'text', interpretation: 'plain', default: '' },
    { name: 'score', storage: 'number', interpretation: 'plain', default: 0 },
    { name: 'streak', storage: 'number', interpretation: 'plain', default: 0 },
    { name: 'kicked', storage: 'number', interpretation: 'plain', default: 0 },
    { name: 'lastSeen', storage: 'number', interpretation: 'plain', default: 0 },
  ],
  ownerField: 'userId',
  permissions: {
    viewer: { read: true, create: true, update: 'own', delete: 'own' },
    member: { read: true, create: true, update: 'own', delete: 'own' },
    admin: { read: true, create: true, update: true, delete: true },
  },
}
