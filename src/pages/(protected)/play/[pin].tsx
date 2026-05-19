/**
 * /play/:pin — player state machine.
 *
 * Mirrors `game.state` and the user's player record. Phases:
 *   nickname pick → lobby → in_question → reveal → leaderboard → ended
 *
 * Reactive everywhere: useQuery subscribes to record changes, no polling.
 * `playerId` is cached in localStorage so refresh restores the session.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useUser } from 'deepspace'
import { motion, AnimatePresence } from 'framer-motion'
import type { Game, Player, Question, Answer } from '../../../lib/types'
import { callAction } from '../../../lib/actions-client'
import { NicknamePicker } from '../../../components/play/NicknamePicker'
import {
  QuestionView,
  type QuestionAnswerPayload,
} from '../../../components/play/QuestionView'
import { ContrastToggle } from '../../../components/play/ContrastToggle'
import { Shape } from '../../../components/play/Shape'
import { SHAPE_COLORS } from '../../../lib/quiz-types'

const PLAYER_KEY_PREFIX = 'kahoot:player:'
const EASE = [0.16, 1, 0.3, 1] as const

export default function PlayPinPage() {
  const { pin = '' } = useParams<{ pin: string }>()
  const { user } = useUser()
  const userId = user?.id ?? ''

  const gamesQ = useQuery<Game>('games', { where: { pin } })
  const gameRec = (gamesQ.records ?? [])[0]
  const game = gameRec?.data
  const gameId = gameRec?.recordId ?? ''

  const playersQ = useQuery<Player>('players', gameId ? { where: { gameId } } : undefined)
  const players = useMemo(() => playersQ.records ?? [], [playersQ.records])

  // Restore playerId from localStorage; verify it still matches a record.
  const [playerId, setPlayerId] = useState<string | null>(null)
  useEffect(() => {
    if (!gameId) return
    const cached = localStorage.getItem(PLAYER_KEY_PREFIX + gameId)
    if (cached && players.some((r) => r.recordId === cached)) {
      setPlayerId(cached)
    } else if (cached && playersQ.status === 'ready' && !players.some((r) => r.recordId === cached)) {
      // Player was kicked or game reset
      localStorage.removeItem(PLAYER_KEY_PREFIX + gameId)
      setPlayerId(null)
    }
  }, [gameId, players, playersQ.status])

  // Fall back to userId match if no cached id (covers anonymous re-mount).
  useEffect(() => {
    if (playerId || !gameId || !userId) return
    const mine = players.find((r) => r.data.userId === userId && r.data.kicked !== 1)
    if (mine) {
      setPlayerId(mine.recordId)
      localStorage.setItem(PLAYER_KEY_PREFIX + gameId, mine.recordId)
    }
  }, [playerId, gameId, userId, players])

  const playerRec = playerId ? players.find((r) => r.recordId === playerId) : undefined
  const player = playerRec?.data

  // ── Loading guards ────────────────────────────────────────────────────────
  if (gamesQ.status === 'loading') return <FullPageSpinner label="Loading game…" />
  if (!game) return <NotFound pin={pin} />

  // ── Kicked ────────────────────────────────────────────────────────────────
  if (player?.kicked === 1) {
    return (
      <BoneShell>
        <ContrastToggle />
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <h2
            className="font-display text-4xl font-bold"
            style={{ color: 'var(--kahoot-stage)', letterSpacing: '-0.02em' }}
          >
            You were removed
            <br />
            from this game.
          </h2>
          <a
            href="/"
            className="mt-8 rounded-full px-5 py-3 font-display text-base font-bold"
            style={{
              background: 'var(--kahoot-stage)',
              color: 'var(--kahoot-stage-paper)',
            }}
          >
            Back to home
          </a>
        </div>
      </BoneShell>
    )
  }

  // ── Phase A: nickname pick ────────────────────────────────────────────────
  if (!playerRec) {
    return (
      <>
        <ContrastToggle />
        <NicknameJoinFlow pin={pin} game={game} gameId={gameId} onJoined={(id) => {
          setPlayerId(id)
          localStorage.setItem(PLAYER_KEY_PREFIX + gameId, id)
        }} />
      </>
    )
  }

  // ── Phase by game.state ───────────────────────────────────────────────────
  return (
    <>
      <ContrastToggle />
      <GamePhases
        game={game}
        gameId={gameId}
        playerId={playerRec.recordId}
        player={playerRec.data}
        players={players}
      />
    </>
  )
}

// ── Nickname join flow wrapper ─────────────────────────────────────────────

function NicknameJoinFlow({
  pin,
  game,
  gameId,
  onJoined,
}: {
  pin: string
  game: Game
  gameId: string
  onJoined: (playerId: string) => void
}) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (game.state !== 'lobby') {
    return (
      <BoneShell>
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <h2
            className="font-display text-4xl font-bold"
            style={{ color: 'var(--kahoot-stage)', letterSpacing: '-0.02em' }}
          >
            Game in progress.
          </h2>
          <p className="mt-3 text-base" style={{ color: 'var(--kahoot-stage)', opacity: 0.65 }}>
            Wait for the host to start the next round.
          </p>
        </div>
      </BoneShell>
    )
  }

  async function handleJoin({ nickname, teamName }: { nickname: string; teamName?: string }) {
    setSubmitting(true)
    setError(null)
    const res = await callAction<{ playerId: string; gameId: string }>('joinGame', {
      pin,
      nickname,
      teamName,
    })
    setSubmitting(false)
    if (!res.success) {
      setError(res.error ?? 'Failed to join')
      return
    }
    if (res.data?.playerId) onJoined(res.data.playerId)
  }

  void gameId

  return (
    <NicknamePicker
      pin={pin}
      generatorEnabled={game.nicknameGeneratorEnabled === 1}
      teamMode={game.teamMode === 1}
      onSubmit={handleJoin}
      submitting={submitting}
      error={error}
    />
  )
}

// ── Game phases driven by game.state ────────────────────────────────────────

function GamePhases({
  game,
  gameId,
  playerId,
  player,
  players,
}: {
  game: Game
  gameId: string
  playerId: string
  player: Player
  players: { recordId: string; data: Player }[]
}) {
  if (game.state === 'lobby') {
    return <LobbyView player={player} />
  }
  if (game.state === 'ended') {
    return <EndedView player={player} players={players} />
  }
  return (
    <ActiveQuestion
      game={game}
      gameId={gameId}
      playerId={playerId}
      player={player}
      players={players}
    />
  )
}

// ── Lobby ───────────────────────────────────────────────────────────────────

function LobbyView({ player }: { player: Player }) {
  return (
    <BoneShell>
      <div className="flex flex-1 flex-col items-center justify-center px-5 py-10">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE }}
          className="w-full max-w-sm"
        >
          <div
            className="relative overflow-hidden rounded-[28px] px-7 py-12 text-center"
            style={{
              background: 'var(--kahoot-stage-paper)',
              boxShadow:
                '0 1px 0 rgba(20,18,30,0.06), 0 24px 48px rgba(20,18,30,0.10)',
              border: '1px solid rgba(20,18,30,0.06)',
            }}
          >
            <div
              className="text-[10px] font-medium uppercase"
              style={{
                letterSpacing: '0.4em',
                color: 'var(--kahoot-stage)',
                opacity: 0.45,
              }}
            >
              You are
            </div>
            <h1
              className="font-display mt-3 break-words text-[44px] font-bold leading-[0.95]"
              style={{
                color: 'var(--kahoot-stage)',
                letterSpacing: '-0.025em',
              }}
            >
              {player.nickname}
            </h1>
            {player.teamName && (
              <div
                className="mt-3 text-sm font-medium"
                style={{ color: 'var(--kahoot-stage)', opacity: 0.6 }}
              >
                Team {player.teamName}
              </div>
            )}

            <PulseRosette />

            <motion.div
              animate={{ opacity: [0.45, 1, 0.45] }}
              transition={{ duration: 2.4, ease: 'easeInOut', repeat: Infinity }}
              className="font-display mt-6 text-base font-medium"
              style={{ color: 'var(--kahoot-stage)' }}
            >
              Hold tight…
            </motion.div>
          </div>
        </motion.div>
      </div>
    </BoneShell>
  )
}

function PulseRosette() {
  // 2x2 of the four sacred shapes.
  return (
    <div className="mt-10 grid w-full max-w-[160px] mx-auto grid-cols-2 gap-3">
      {SHAPE_COLORS.map((c, i) => (
        <motion.div
          key={c.name}
          animate={{ scale: [1, 1.08, 1] }}
          transition={{
            duration: 1.6,
            ease: 'easeInOut',
            repeat: Infinity,
            delay: i * 0.18,
          }}
          className="flex aspect-square items-center justify-center rounded-2xl"
          style={{ backgroundColor: c.color }}
        >
          <Shape
            shape={c.name}
            className="text-white"
            style={{ width: '54%', height: '54%' }}
          />
        </motion.div>
      ))}
    </div>
  )
}

// ── In-question / Reveal / Leaderboard ──────────────────────────────────────

function ActiveQuestion({
  game,
  gameId,
  playerId,
  player,
  players,
}: {
  game: Game
  gameId: string
  playerId: string
  player: Player
  players: { recordId: string; data: Player }[]
}) {
  const questionsQ = useQuery<Question>('questions', { where: { quizId: game.quizId } })
  const sortedQs = useMemo(() => {
    return (questionsQ.records ?? [])
      .slice()
      .sort((a, b) => a.data.order - b.data.order)
  }, [questionsQ.records])
  const questionRec = sortedQs[game.currentQuestionIndex]

  const answersQ = useQuery<Answer>('answers', { where: { gameId, playerId } })
  const myAnswerForQ = useMemo(() => {
    return (answersQ.records ?? []).find(
      (r) => r.data.questionIndex === game.currentQuestionIndex,
    )
  }, [answersQ.records, game.currentQuestionIndex])

  // Track submission state locally so UI flips fast (before the answer record
  // round-trips back through useQuery).
  const [optimisticAnswered, setOptimisticAnswered] = useState(false)
  const lastQIndexRef = useRef<number>(game.currentQuestionIndex)
  useEffect(() => {
    if (game.currentQuestionIndex !== lastQIndexRef.current) {
      lastQIndexRef.current = game.currentQuestionIndex
      setOptimisticAnswered(false)
    }
  }, [game.currentQuestionIndex])

  if (!questionRec) {
    return <FullPageSpinner label="Waiting for question…" />
  }

  const alreadyAnswered = !!myAnswerForQ || optimisticAnswered

  async function handleSubmit(payload: QuestionAnswerPayload) {
    if (alreadyAnswered) return
    setOptimisticAnswered(true)
    const responseTimeMs = Math.max(0, Date.now() - (game.currentQuestionStartedAt ?? Date.now()))
    const res = await callAction('submitAnswer', {
      gameId,
      playerId,
      questionIndex: game.currentQuestionIndex,
      responseTimeMs,
      ...payload,
    })
    if (!res.success) {
      setOptimisticAnswered(false)
    }
  }

  if (game.state === 'in_question') {
    return (
      <QuestionView
        question={questionRec.data}
        questionStartedAt={game.currentQuestionStartedAt}
        onSubmit={handleSubmit}
        alreadyAnswered={alreadyAnswered}
        myOptionIndex={myAnswerForQ?.data.optionIndex ?? null}
        myTextAnswer={myAnswerForQ?.data.textAnswer ?? null}
        myNumberAnswer={myAnswerForQ?.data.numberAnswer ?? null}
      />
    )
  }

  if (game.state === 'reveal') {
    return <RevealView answer={myAnswerForQ?.data ?? null} player={player} players={players} />
  }

  // leaderboard
  return <LeaderboardView player={player} players={players} />
}

// ── Reveal — full-screen takeover, one word per screen ─────────────────────

function RevealView({
  answer,
  player,
  players,
}: {
  answer: Answer | null
  player: Player
  players: { recordId: string; data: Player }[]
}) {
  const sorted = useMemo(() => {
    return players
      .filter((r) => r.data.kicked !== 1)
      .slice()
      .sort((a, b) => b.data.score - a.data.score)
  }, [players])
  const myRank =
    sorted.findIndex(
      (r) =>
        r.data.nickname === player.nickname && r.data.userId === player.userId,
    ) + 1
  const ahead = myRank > 1 ? sorted[myRank - 2]?.data : null
  const gapAbove = ahead ? Math.max(0, ahead.score - player.score) : 0

  const correct = answer?.correct === 1
  const tooSlow = !answer
  const points = answer?.pointsAwarded ?? 0

  let bg: string
  let fg: string
  let headline: string
  let subheadColor: string

  if (tooSlow) {
    bg = 'var(--color-muted)'
    fg = 'var(--kahoot-stage)'
    headline = 'Too slow!'
    subheadColor = 'rgba(20,18,30,0.55)'
  } else if (correct) {
    bg = 'var(--kahoot-stage-paper)'
    fg = 'var(--kahoot-stage)'
    headline = 'Correct!'
    subheadColor = 'rgba(20,18,30,0.55)'
  } else {
    bg = 'var(--kahoot-stage)'
    fg = 'var(--kahoot-stage-paper)'
    headline = 'Not this time'
    subheadColor = 'rgba(255,255,255,0.55)'
  }

  return (
    <motion.div
      key={`reveal-${correct ? 'c' : tooSlow ? 't' : 'w'}`}
      initial={{ y: 60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: EASE }}
      className="flex flex-col items-center justify-center px-6"
      style={{ minHeight: '100dvh', background: bg, color: fg }}
    >
      <div
        className="font-display text-center"
        style={{
          fontSize: 'clamp(56px, 14vw, 120px)',
          fontWeight: 700,
          letterSpacing: '-0.03em',
          lineHeight: 0.95,
        }}
      >
        {headline}
      </div>

      {!tooSlow && correct && (
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4, ease: EASE, delay: 0.15 }}
          className="font-display tabular mt-6 text-[44px] font-bold"
          style={{ color: 'var(--kahoot-spotlight)', letterSpacing: '-0.02em' }}
        >
          +{points} pts
        </motion.div>
      )}

      {!tooSlow && !correct && (
        <div
          className="font-display tabular mt-6 text-[36px] font-bold"
          style={{ color: subheadColor, letterSpacing: '-0.02em' }}
        >
          +0 pts
        </div>
      )}

      <div
        className="mt-8 font-medium text-sm text-center"
        style={{ color: subheadColor }}
      >
        {myRank > 0 ? (
          <>
            You're {ordinal(myRank)}
            {ahead && gapAbove > 0 && (
              <>
                {' '}
                ·{' '}
                <span className="tabular">{gapAbove}</span> behind{' '}
                {ordinal(myRank - 1)}
              </>
            )}
          </>
        ) : (
          <>Score {player.score}</>
        )}
      </div>
    </motion.div>
  )
}

// ── Leaderboard — stay calm, the host screen has the show ──────────────────

function LeaderboardView({
  player,
  players,
}: {
  player: Player
  players: { recordId: string; data: Player }[]
}) {
  const sorted = useMemo(() => {
    return players
      .filter((r) => r.data.kicked !== 1)
      .slice()
      .sort((a, b) => b.data.score - a.data.score)
  }, [players])
  const myRank =
    sorted.findIndex(
      (r) =>
        r.data.nickname === player.nickname && r.data.userId === player.userId,
    ) + 1

  return (
    <BoneShell>
      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <motion.div
          animate={{ y: [0, -4, 0] }}
          transition={{ duration: 1.6, ease: 'easeInOut', repeat: Infinity }}
          className="text-[10px] font-medium uppercase"
          style={{
            letterSpacing: '0.4em',
            color: 'var(--kahoot-stage)',
            opacity: 0.5,
          }}
        >
          Look up ↑
        </motion.div>

        <div
          className="font-display mt-10 text-[14px] font-medium uppercase"
          style={{
            color: 'var(--kahoot-stage)',
            opacity: 0.55,
            letterSpacing: '0.2em',
          }}
        >
          Rank
        </div>
        <div
          className="font-display tabular"
          style={{
            color: 'var(--kahoot-stage)',
            fontSize: 'clamp(72px, 22vw, 156px)',
            fontWeight: 700,
            letterSpacing: '-0.04em',
            lineHeight: 1,
          }}
        >
          {myRank > 0 ? `#${myRank}` : '—'}
        </div>
        <div
          className="font-display tabular mt-2 text-2xl font-bold"
          style={{ color: 'var(--kahoot-stage)', opacity: 0.7 }}
        >
          {player.score} pts
        </div>
      </div>
    </BoneShell>
  )
}

// ── Ended ───────────────────────────────────────────────────────────────────

function EndedView({
  player,
  players,
}: {
  player: Player
  players: { recordId: string; data: Player }[]
}) {
  const sorted = players
    .filter((r) => r.data.kicked !== 1)
    .slice()
    .sort((a, b) => b.data.score - a.data.score)
  const rank =
    sorted.findIndex(
      (r) =>
        r.data.nickname === player.nickname && r.data.userId === player.userId,
    ) + 1
  const podium = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null
  const place = rank > 0 ? `${ordinal(rank)} place` : 'Great game'

  return (
    <BoneShell>
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-10 text-center">
        <AnimatePresence>
          <motion.div
            key="ended"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: EASE }}
          >
            {podium && (
              <div
                className="text-[88px] leading-none"
                aria-hidden
              >
                {podium}
              </div>
            )}
            <h1
              className="font-display mt-4 text-[44px] font-bold"
              style={{
                color: 'var(--kahoot-stage)',
                letterSpacing: '-0.025em',
                lineHeight: 1,
              }}
            >
              {place}
            </h1>
            <div
              className="font-display tabular mt-6 text-[56px] font-bold"
              style={{
                color: 'var(--kahoot-stage)',
                letterSpacing: '-0.03em',
                lineHeight: 1,
              }}
            >
              {player.score}
            </div>
            <div
              className="mt-1 text-sm font-medium uppercase"
              style={{
                color: 'var(--kahoot-stage)',
                opacity: 0.55,
                letterSpacing: '0.28em',
              }}
            >
              points
            </div>
            <div
              className="mt-10 max-w-xs text-base"
              style={{ color: 'var(--kahoot-stage)', opacity: 0.7 }}
            >
              Thanks for playing, {player.nickname}.
            </div>
            <a
              href="/"
              className="mt-8 inline-block rounded-full px-6 py-3 font-display text-base font-bold"
              style={{
                background: 'var(--kahoot-spotlight)',
                color: 'var(--kahoot-stage)',
              }}
            >
              Back to home
            </a>
          </motion.div>
        </AnimatePresence>
      </div>
    </BoneShell>
  )
}

// ── Layout / loading helpers ───────────────────────────────────────────────

function BoneShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex flex-col"
      style={{
        minHeight: '100dvh',
        background: 'var(--kahoot-stage-paper)',
        color: 'var(--kahoot-stage)',
      }}
    >
      {children}
    </div>
  )
}

function FullPageSpinner({ label }: { label: string }) {
  return (
    <BoneShell>
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1.2, ease: 'linear', repeat: Infinity }}
          className="h-6 w-6 rounded-full border-2"
          style={{
            borderColor: 'rgba(20,18,30,0.15)',
            borderTopColor: 'var(--kahoot-stage)',
          }}
        />
        <span
          className="text-sm font-medium"
          style={{ color: 'var(--kahoot-stage)', opacity: 0.6 }}
        >
          {label}
        </span>
      </div>
    </BoneShell>
  )
}

function NotFound({ pin }: { pin: string }) {
  return (
    <BoneShell>
      <ContrastToggle />
      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <h2
          className="font-display text-[40px] font-bold"
          style={{ color: 'var(--kahoot-stage)', letterSpacing: '-0.025em', lineHeight: 1 }}
        >
          No game with PIN
        </h2>
        <div
          className="font-display tabular mt-3 text-[64px] font-bold"
          style={{
            color: 'var(--kahoot-stage)',
            letterSpacing: '0.06em',
            lineHeight: 1,
          }}
        >
          {pin}
        </div>
        <a
          href="/play"
          className="mt-8 rounded-full px-6 py-3 font-display text-base font-bold"
          style={{
            background: 'var(--kahoot-spotlight)',
            color: 'var(--kahoot-stage)',
          }}
        >
          Try a different PIN
        </a>
      </div>
    </BoneShell>
  )
}

function ordinal(n: number): string {
  if (n <= 0) return `${n}`
  const v = n % 100
  if (v >= 11 && v <= 13) return `${n}th`
  switch (n % 10) {
    case 1: return `${n}st`
    case 2: return `${n}nd`
    case 3: return `${n}rd`
    default: return `${n}th`
  }
}
