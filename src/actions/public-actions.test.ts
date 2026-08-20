import { describe, it, expect } from 'vitest'
import { actions, PUBLIC_ACTIONS } from './index'

/** Every action that mutates a quiz, a game's lifecycle, or another player. */
const AUTHORING_ACTIONS = [
  'createQuiz', 'updateQuiz', 'deleteQuiz', 'duplicateQuiz',
  'createQuestion', 'updateQuestion', 'deleteQuestion', 'reorderQuestions',
  'createGame', 'kickPlayer',
  'startGame', 'revealAnswer', 'showLeaderboard', 'nextQuestion', 'endGame',
]

describe('PUBLIC_ACTIONS', () => {
  it('opens exactly the two calls the player journey makes', () => {
    expect([...PUBLIC_ACTIONS].sort()).toEqual(['joinGame', 'submitAnswer'])
  })

  it('holds no authoring capability', () => {
    // The worker skips the JWT check for anything on this list, so an
    // authoring action landing here would hand the app to the internet.
    for (const name of AUTHORING_ACTIONS) {
      expect(PUBLIC_ACTIONS.has(name), `${name} must require sign-in`).toBe(false)
    }
  })

  it('names only actions that exist', () => {
    // A typo here fails open in the other direction: the real action keeps
    // returning 401 to guests and joining silently stays broken.
    for (const name of PUBLIC_ACTIONS) {
      expect(actions[name], `${name} is not a registered action`).toBeTypeOf('function')
    }
  })

  it('covers the whole registry between public and authoring', () => {
    // Guards against a new action being added and classified as neither.
    const classified = new Set([...PUBLIC_ACTIONS, ...AUTHORING_ACTIONS])
    expect(Object.keys(actions).filter((name) => !classified.has(name))).toEqual([])
  })
})
