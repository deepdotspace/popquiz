import type { ActionHandler } from 'deepspace/worker'
import {
  createQuiz, updateQuiz, deleteQuiz, duplicateQuiz,
  createQuestion, updateQuestion, deleteQuestion, reorderQuestions,
} from './quizzes'
import {
  createGame, joinGame, kickPlayer,
  startGame, revealAnswer, showLeaderboard, nextQuestion, endGame,
  submitAnswer,
} from './games'

export const actions: Record<string, ActionHandler> = {
  // Quiz authoring
  createQuiz,
  updateQuiz,
  deleteQuiz,
  duplicateQuiz,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  reorderQuestions,

  // Game lifecycle
  createGame,
  joinGame,
  kickPlayer,
  startGame,
  revealAnswer,
  showLeaderboard,
  nextQuestion,
  endGame,
  submitAnswer,
}

/**
 * The actions a signed-out visitor may call.
 *
 * Scanning a QR code or typing a PIN is the whole player journey — "no app, no
 * login, just a PIN" — so joining and answering are public. Everything else in
 * `actions` is an authoring capability (create, host, kick, end, report) and
 * the worker answers 401 for it without a verified JWT.
 *
 * Both public actions authorize the caller against the specific player row
 * they name, so listing them here grants nobody access to anyone else's slot.
 */
export const PUBLIC_ACTIONS: ReadonlySet<string> = new Set(['joinGame', 'submitAnswer'])
