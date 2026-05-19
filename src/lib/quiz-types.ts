/**
 * Question types supported in MVP.
 *
 * Type-specific data lives in `questions.data` (JSON column):
 *   mcq        → { options: [{ text, correct }], multiCorrect?: boolean }
 *   poll       → { options: [{ text }] }                  // no scoring
 *   true_false → { correctAnswer: boolean }
 *   type_answer→ { correctAnswer: string, alternates?: string[] }
 *   slider     → { min, max, target, tolerance }          // tolerance = % of range
 */

export const QUESTION_TYPES = {
  MCQ: 'mcq',
  POLL: 'poll',
  TRUE_FALSE: 'true_false',
  TYPE_ANSWER: 'type_answer',
  SLIDER: 'slider',
} as const

export type QuestionType = typeof QUESTION_TYPES[keyof typeof QUESTION_TYPES]

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  mcq: 'Multiple Choice',
  poll: 'Poll',
  true_false: 'True / False',
  type_answer: 'Type Answer',
  slider: 'Slider',
}

export interface McqOption {
  text: string
  correct: boolean
}

export interface McqData {
  options: McqOption[]
  multiCorrect?: boolean
}

export interface PollData {
  options: { text: string }[]
}

export interface TrueFalseData {
  correctAnswer: boolean
}

export interface TypeAnswerData {
  correctAnswer: string
  alternates?: string[]
}

export interface SliderData {
  min: number
  max: number
  target: number
  /** Tolerance as a fraction of (max - min). 0.05 = full points within 5% of target. */
  tolerance: number
}

export type QuestionData =
  | McqData
  | PollData
  | TrueFalseData
  | TypeAnswerData
  | SliderData

export const MEDIA_TYPES = {
  NONE: 'none',
  IMAGE: 'image',
  VIDEO: 'video',
  AUDIO: 'audio',
  YOUTUBE: 'youtube',
} as const

export type MediaType = typeof MEDIA_TYPES[keyof typeof MEDIA_TYPES]

/** Iconic Kahoot answer-button colors + shapes. Indices map to MCQ option order. */
export const SHAPE_COLORS = [
  { name: 'triangle', color: '#E21B3C', label: 'Triangle' },   // red
  { name: 'diamond',  color: '#1368CE', label: 'Diamond' },    // blue
  { name: 'circle',   color: '#D89E00', label: 'Circle' },     // yellow
  { name: 'square',   color: '#26890C', label: 'Square' },     // green
] as const

export const TIME_LIMIT_OPTIONS = [5, 10, 20, 30, 60, 90, 120, 240] as const
