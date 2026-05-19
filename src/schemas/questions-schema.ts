import type { CollectionSchema } from 'deepspace/worker'

/**
 * Questions belong to a quiz. `data` holds type-specific config as a JSON
 * string (parsed at the UI layer) — keeps the schema flat and flexible
 * across MCQ, slider, type-answer, etc.
 */
export const questionsSchema: CollectionSchema = {
  name: 'questions',
  columns: [
    { name: 'quizId', storage: 'text', interpretation: 'plain', required: true },
    { name: 'order', storage: 'number', interpretation: 'plain', required: true },
    { name: 'type', storage: 'text', interpretation: 'plain', required: true },
    { name: 'text', storage: 'text', interpretation: 'plain', default: '' },
    { name: 'data', storage: 'text', interpretation: 'plain', default: '{}' },
    { name: 'timeLimit', storage: 'number', interpretation: 'plain', default: 20 },
    { name: 'pointsMode', storage: 'text', interpretation: 'plain', default: 'standard' },
    { name: 'mediaType', storage: 'text', interpretation: 'plain', default: 'none' },
    { name: 'mediaUrl', storage: 'text', interpretation: 'plain', default: '' },
    { name: 'ownerId', storage: 'text', interpretation: 'plain', required: true, userBound: true, immutable: true },
  ],
  ownerField: 'ownerId',
  permissions: {
    viewer: { read: true, create: false, update: false, delete: false },
    member: { read: true, create: true, update: 'own', delete: 'own' },
    admin: { read: true, create: true, update: true, delete: true },
  },
}
