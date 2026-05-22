/**
 * Game lifecycle actions: create / join / kick / state transitions.
 * All scoring + state mutation happens here; clients do not write directly.
 */

import type { ActionHandler, ActionTools } from 'deepspace/worker'
import { patchRecord, queryRecords, unwrap } from './_helpers'
import type { Game, Player, Question, Answer } from '../lib/types'
import { generatePin } from '../lib/pin'
import { validateNickname } from '../lib/profanity'
import { computeScore } from '../lib/scoring'

async function loadHostGame(
  tools: ActionTools,
  gameId: string,
  userId: string,
): Promise<Game | null> {
  const res = await tools.get('games', gameId)
  const game = unwrap<Game>(res)
  if (!game || game.hostId !== userId) return null
  return game
}

export const createGame: ActionHandler = async ({ userId, params, tools }) => {
  const quizId = String(params.quizId ?? '')
  if (!quizId) return { success: false, error: 'quizId required' }

  // Verify quiz has at least one question — empty games are a confusing UX.
  const qs = await queryRecords<Question>(tools, 'questions', { where: { quizId } })
  if (qs.length === 0) return { success: false, error: 'Quiz has no questions' }

  // Allocate PIN that's not in use by an active (non-ended) game.
  let pin = ''
  for (let attempt = 0; attempt < 5; attempt++) {
    pin = generatePin()
    const existing = await queryRecords<Game>(tools, 'games', { where: { pin } })
    const live = existing.find((g) => g.data.state !== 'ended')
    if (!live) break
    pin = ''
  }
  if (!pin) return { success: false, error: 'Could not allocate a PIN, try again' }

  return tools.create('games', {
    pin,
    quizId,
    hostId: userId,
    mode: String(params.mode ?? 'live'),
    state: 'lobby',
    currentQuestionIndex: 0,
    currentQuestionStartedAt: 0,
    scoringMode: String(params.scoringMode ?? 'standard'),
    streakBonusEnabled: params.streakBonusEnabled === false ? 0 : 1,
    nicknameGeneratorEnabled: params.nicknameGeneratorEnabled === false ? 0 : 1,
    teamMode: params.teamMode === true ? 1 : 0,
    deadlineAt: Number(params.deadlineAt ?? 0),
    endedAt: 0,
  })
}

export const joinGame: ActionHandler = async ({ userId, params, tools }) => {
  const pin = String(params.pin ?? '')
  const nickname = String(params.nickname ?? '').trim()
  const teamName = String(params.teamName ?? '').trim()

  if (!pin || !/^\d{6}$/.test(pin)) return { success: false, error: 'Invalid PIN' }
  const validation = validateNickname(nickname)
  if (!validation.ok) return { success: false, error: validation.reason }

  const games = await queryRecords<Game>(tools, 'games', { where: { pin } })
  const game = games.find((g) => g.data.state !== 'ended')
  if (!game) return { success: false, error: 'Game not found' }
  if (game.data.mode === 'live' && game.data.state !== 'lobby') {
    return { success: false, error: 'Game already started' }
  }
  if (
    game.data.mode === 'assignment' &&
    game.data.deadlineAt > 0 &&
    Date.now() > game.data.deadlineAt
  ) {
    return { success: false, error: 'Assignment deadline has passed' }
  }

  // Reuse player row if same user reconnects.
  const existing = await queryRecords<Player>(tools, 'players', {
    where: { gameId: game.recordId, userId },
  })
  const same = existing.find((p) => p.data.userId === userId)
  if (same) {
    if (same.data.kicked) return { success: false, error: 'You were kicked from this game.' }
    const patched = await patchRecord(tools, 'players', same.recordId, {
      nickname,
      teamName,
      lastSeen: Date.now(),
    })
    if (!patched.success) return patched
    return { success: true, data: { playerId: same.recordId, gameId: game.recordId } }
  }

  // Block duplicate nicknames in the same game.
  const allPlayers = await queryRecords<Player>(tools, 'players', { where: { gameId: game.recordId } })
  if (allPlayers.some((p) => p.data.nickname.toLowerCase() === nickname.toLowerCase())) {
    return { success: false, error: 'Nickname already taken' }
  }

  const created = await tools.create('players', {
    gameId: game.recordId,
    userId,
    nickname,
    teamName,
    score: 0,
    streak: 0,
    kicked: 0,
    lastSeen: Date.now(),
  })
  if (!created.success) return created
  return { success: true, data: { playerId: created.data.recordId, gameId: game.recordId } }
}

export const kickPlayer: ActionHandler = async ({ userId, params, tools }) => {
  const gameId = String(params.gameId ?? '')
  const playerId = String(params.playerId ?? '')
  if (!gameId || !playerId) return { success: false, error: 'gameId + playerId required' }
  if (!(await loadHostGame(tools, gameId, userId))) return { success: false, error: 'Forbidden' }
  return patchRecord(tools, 'players', playerId, { kicked: 1 })
}

export const startGame: ActionHandler = async ({ userId, params, tools }) => {
  const gameId = String(params.gameId ?? '')
  if (!(await loadHostGame(tools, gameId, userId))) return { success: false, error: 'Forbidden' }
  return patchRecord(tools, 'games', gameId, {
    state: 'in_question',
    currentQuestionIndex: 0,
    currentQuestionStartedAt: Date.now(),
  })
}

export const revealAnswer: ActionHandler = async ({ userId, params, tools }) => {
  const gameId = String(params.gameId ?? '')
  if (!(await loadHostGame(tools, gameId, userId))) return { success: false, error: 'Forbidden' }
  return patchRecord(tools, 'games', gameId, { state: 'reveal' })
}

export const showLeaderboard: ActionHandler = async ({ userId, params, tools }) => {
  const gameId = String(params.gameId ?? '')
  if (!(await loadHostGame(tools, gameId, userId))) return { success: false, error: 'Forbidden' }
  return patchRecord(tools, 'games', gameId, { state: 'leaderboard' })
}

export const nextQuestion: ActionHandler = async ({ userId, params, tools }) => {
  const gameId = String(params.gameId ?? '')
  const game = await loadHostGame(tools, gameId, userId)
  if (!game) return { success: false, error: 'Forbidden' }
  const next = game.currentQuestionIndex + 1
  const qs = await queryRecords<Question>(tools, 'questions', { where: { quizId: game.quizId } })
  if (next >= qs.length) {
    return patchRecord(tools, 'games', gameId, { state: 'ended', endedAt: Date.now() })
  }
  return patchRecord(tools, 'games', gameId, {
    state: 'in_question',
    currentQuestionIndex: next,
    currentQuestionStartedAt: Date.now(),
  })
}

export const endGame: ActionHandler = async ({ userId, params, tools }) => {
  const gameId = String(params.gameId ?? '')
  if (!(await loadHostGame(tools, gameId, userId))) return { success: false, error: 'Forbidden' }
  return patchRecord(tools, 'games', gameId, { state: 'ended', endedAt: Date.now() })
}

// ---------------------------------------------------------------------------
// Scoring on submit — the load-bearing one.
// ---------------------------------------------------------------------------

export const submitAnswer: ActionHandler = async ({ userId, params, tools }) => {
  const gameId = String(params.gameId ?? '')
  const playerId = String(params.playerId ?? '')
  const questionIndex = Number(params.questionIndex ?? -1)
  if (!gameId || !playerId || questionIndex < 0) {
    return { success: false, error: 'gameId + playerId + questionIndex required' }
  }

  const game = unwrap<Game>(await tools.get('games', gameId))
  if (!game) return { success: false, error: 'Game not found' }
  if (
    game.mode === 'assignment' &&
    game.deadlineAt > 0 &&
    Date.now() > game.deadlineAt
  ) {
    return { success: false, error: 'Assignment deadline has passed' }
  }

  const player = unwrap<Player>(await tools.get('players', playerId))
  if (!player) return { success: false, error: 'Player not found' }
  if (player.userId !== userId) return { success: false, error: 'Not your player slot' }
  if (player.kicked) return { success: false, error: 'You were kicked' }

  const allQs = await queryRecords<Question>(tools, 'questions', { where: { quizId: game.quizId } })
  const sortedQs = allQs.slice().sort((a, b) => a.data.order - b.data.order)
  const question = sortedQs[questionIndex]
  if (!question) return { success: false, error: 'Question not found' }

  // Disallow double-submission.
  const prior = await queryRecords<Answer>(tools, 'answers', {
    where: { gameId, playerId, questionIndex },
  })
  if (prior.length > 0) return { success: false, error: 'Already answered' }

  const qData = parseJson(question.data.data) as Record<string, unknown>
  const optionIndex = Number(params.optionIndex ?? -1)
  const textAnswer = String(params.textAnswer ?? '')
  const numberAnswer = Number(params.numberAnswer ?? 0)
  let correct = false

  switch (question.data.type) {
    case 'mcq': {
      const options = (qData.options as { correct: boolean }[]) ?? []
      correct = optionIndex >= 0 && optionIndex < options.length && !!options[optionIndex]?.correct
      break
    }
    case 'poll': {
      correct = false  // polls don't award points
      break
    }
    case 'true_false': {
      const answer = optionIndex === 1
      correct = answer === !!qData.correctAnswer
      break
    }
    case 'type_answer': {
      const target = String(qData.correctAnswer ?? '').toLowerCase().trim()
      const alts = (qData.alternates as string[] ?? []).map((s) => s.toLowerCase().trim())
      const submitted = textAnswer.toLowerCase().trim()
      correct = submitted === target || alts.includes(submitted)
      break
    }
    case 'slider': {
      const target = Number(qData.target ?? 0)
      const min = Number(qData.min ?? 0)
      const max = Number(qData.max ?? 100)
      const tolerance = Number(qData.tolerance ?? 0.05)
      const range = Math.max(1, max - min)
      const distance = Math.abs(numberAnswer - target)
      correct = distance / range <= tolerance
      break
    }
  }

  // Response time: client may pass ms, otherwise compute from currentQuestionStartedAt.
  const responseTimeMs = Number(
    params.responseTimeMs ?? Math.max(0, Date.now() - (game.currentQuestionStartedAt || Date.now())),
  )

  const noPoints = question.data.pointsMode === 'none' || question.data.type === 'poll'
  const newStreak = correct ? player.streak + 1 : 0
  const pointsAwarded = noPoints ? 0 : computeScore({
    correct,
    responseTimeMs,
    timeLimitSec: question.data.timeLimit,
    scoringMode: (game.scoringMode as 'standard' | 'accuracy') ?? 'standard',
    streakAfter: newStreak,
    streakBonusEnabled: !!game.streakBonusEnabled,
  })

  const ansCreated = await tools.create('answers', {
    gameId,
    playerId,
    userId,
    questionIndex,
    optionIndex,
    textAnswer,
    numberAnswer,
    correct: correct ? 1 : 0,
    responseTimeMs,
    pointsAwarded,
  })
  if (!ansCreated.success) return ansCreated
  const scorePatched = await patchRecord(tools, 'players', playerId, {
    score: player.score + pointsAwarded,
    streak: newStreak,
    lastSeen: Date.now(),
  })
  if (!scorePatched.success) return scorePatched

  return {
    success: true,
    data: { correct, pointsAwarded, newScore: player.score + pointsAwarded, streak: newStreak },
  }
}

function parseJson(s: string): unknown {
  try { return JSON.parse(s) } catch { return {} }
}
