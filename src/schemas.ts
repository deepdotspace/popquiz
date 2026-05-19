/**
 * Collection Schemas
 *
 * All collections with columns and RBAC permissions.
 * Single source of truth — imported by both worker and frontend.
 */

import type { CollectionSchema } from 'deepspace/worker'
import { usersSchema } from './schemas/users-schema'
import { settingsSchema } from './schemas/admin-schema'
import { quizzesSchema } from './schemas/quizzes-schema'
import { questionsSchema } from './schemas/questions-schema'
import { gamesSchema } from './schemas/games-schema'
import { playersSchema } from './schemas/players-schema'
import { answersSchema } from './schemas/answers-schema'

export const schemas: CollectionSchema[] = [
  usersSchema,
  settingsSchema,
  quizzesSchema,
  questionsSchema,
  gamesSchema,
  playersSchema,
  answersSchema,
]
