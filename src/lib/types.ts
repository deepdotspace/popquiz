/**
 * Shared TypeScript types for records as they come back from the SDK.
 * Mirrors the schema columns; not auto-generated.
 */

// Index signatures let these types flow through the SDK's
// `<T extends Record<string, unknown>>` generic constraints in tools.get/
// query/create/update without explicit casts at every call site.

export interface Quiz {
  title: string
  description: string
  theme: string
  coverImage: string
  ownerId: string
  [key: string]: unknown
}

export interface Question {
  quizId: string
  order: number
  type: string
  text: string
  /** JSON-stringified type-specific data — see lib/quiz-types.ts. */
  data: string
  timeLimit: number
  pointsMode: string  // 'standard' | 'none'
  mediaType: string   // 'none' | 'image' | 'video' | 'audio' | 'youtube'
  mediaUrl: string
  ownerId: string
  [key: string]: unknown
}

export interface Game {
  pin: string
  quizId: string
  hostId: string
  mode: string         // 'live' | 'assignment'
  state: string        // 'lobby' | 'in_question' | 'reveal' | 'leaderboard' | 'ended'
  currentQuestionIndex: number
  currentQuestionStartedAt: number
  scoringMode: string  // 'standard' | 'accuracy'
  streakBonusEnabled: number
  nicknameGeneratorEnabled: number
  teamMode: number
  deadlineAt: number
  endedAt: number
  [key: string]: unknown
}

export interface Player {
  gameId: string
  userId: string
  nickname: string
  teamName: string
  score: number
  streak: number
  kicked: number
  lastSeen: number
  [key: string]: unknown
}

export interface Answer {
  gameId: string
  playerId: string
  userId: string
  questionIndex: number
  optionIndex: number
  textAnswer: string
  numberAnswer: number
  correct: number
  responseTimeMs: number
  pointsAwarded: number
  [key: string]: unknown
}
