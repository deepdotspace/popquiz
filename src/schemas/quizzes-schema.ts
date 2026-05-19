import type { CollectionSchema } from 'deepspace/worker'

export const quizzesSchema: CollectionSchema = {
  name: 'quizzes',
  columns: [
    { name: 'title', storage: 'text', interpretation: 'plain', required: true },
    { name: 'description', storage: 'text', interpretation: 'plain', default: '' },
    { name: 'theme', storage: 'text', interpretation: 'plain', default: 'classic' },
    { name: 'coverImage', storage: 'text', interpretation: 'plain', default: '' },
    { name: 'ownerId', storage: 'text', interpretation: 'plain', required: true, userBound: true, immutable: true },
  ],
  ownerField: 'ownerId',
  permissions: {
    viewer: { read: true, create: false, update: false, delete: false },
    member: { read: true, create: true, update: 'own', delete: 'own' },
    admin: { read: true, create: true, update: true, delete: true },
  },
}
