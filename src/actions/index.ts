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
