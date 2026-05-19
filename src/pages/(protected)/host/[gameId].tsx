/**
 * Host live game UI — projector view.
 *
 * One screen. Two energy modes:
 *   - lobby + ended → bone background, ink text, lime accents (calm anchor)
 *   - in_question + reveal + leaderboard → deep ink stage, bone text, saturated shape colors
 *
 * The screen takes over the viewport with `fixed inset-0` and hides global nav.
 * Every text element is sized to read across a classroom.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery, useUser } from 'deepspace'
import { motion, AnimatePresence } from 'framer-motion'
import { callAction } from '../../../lib/actions-client'
import { SHAPE_COLORS } from '../../../lib/quiz-types'
import type { Game, Player, Question, Answer } from '../../../lib/types'

type RecordRow<T> = { recordId: string; data: T }

interface ParsedQuestionData {
  options?: { text: string; correct?: boolean }[]
  correctAnswer?: string | boolean
  alternates?: string[]
  min?: number
  max?: number
  target?: number
  tolerance?: number
}

function parseQuestion(q: Question): ParsedQuestionData {
  try { return JSON.parse(q.data) as ParsedQuestionData } catch { return {} }
}

// ─── motion tokens ────────────────────────────────────────────────────────
const EASE_OUT_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1]

const STAGE_INK = 'var(--kahoot-stage)'
const STAGE_PAPER = 'var(--kahoot-stage-paper)'
const LIME = 'var(--color-primary)'
const INK = 'var(--color-foreground)'

// True/false uses red triangle for True (idx 0), blue diamond for False — but
// genre convention is green=true, red=false. We keep blue/red here to match
// the player phone wiring already established.
const TF_SHAPE_INDICES = [3, 0] as const // green for True, red for False

// ─── shape SVGs (the sacred 4) ────────────────────────────────────────────
function ShapeIcon({ name, size = 56, color = '#fff' }: { name: string; size?: number; color?: string }) {
  const s = size
  if (name === 'triangle') {
    return (
      <svg width={s} height={s} viewBox="0 0 100 100" fill={color} aria-hidden>
        <polygon points="50,12 92,86 8,86" />
      </svg>
    )
  }
  if (name === 'diamond') {
    return (
      <svg width={s} height={s} viewBox="0 0 100 100" fill={color} aria-hidden>
        <polygon points="50,8 92,50 50,92 8,50" />
      </svg>
    )
  }
  if (name === 'circle') {
    return (
      <svg width={s} height={s} viewBox="0 0 100 100" fill={color} aria-hidden>
        <circle cx="50" cy="50" r="42" />
      </svg>
    )
  }
  if (name === 'square') {
    return (
      <svg width={s} height={s} viewBox="0 0 100 100" fill={color} aria-hidden>
        <rect x="10" y="10" width="80" height="80" rx="6" />
      </svg>
    )
  }
  return null
}

// ─── root ─────────────────────────────────────────────────────────────────
export default function HostGamePage() {
  const { gameId = '' } = useParams<{ gameId: string }>()
  const { user } = useUser()
  const navigate = useNavigate()

  const gamesQ = useQuery<Game>('games', {})
  const game = useMemo<RecordRow<Game> | undefined>(() => {
    return (gamesQ.records ?? []).find((r: RecordRow<Game>) => r.recordId === gameId)
  }, [gamesQ.records, gameId])

  const playersQ = useQuery<Player>('players', { where: { gameId } })
  const players = useMemo<RecordRow<Player>[]>(
    () => (playersQ.records ?? []).filter((r: RecordRow<Player>) => !r.data.kicked),
    [playersQ.records],
  )

  const questionsQ = useQuery<Question>('questions', {
    where: { quizId: game?.data.quizId ?? '__no_quiz__' },
    orderBy: 'order',
    orderDir: 'asc',
  })
  const questions = useMemo<RecordRow<Question>[]>(() => {
    const list = (questionsQ.records ?? []) as RecordRow<Question>[]
    return list.slice().sort((a, b) => a.data.order - b.data.order)
  }, [questionsQ.records])

  // Ownership / loading states use the calm bone aesthetic.
  if (gamesQ.status === 'loading' && !game) {
    return <CalmCenter><span style={{ color: 'oklch(45% 0.025 270)' }}>Loading game…</span></CalmCenter>
  }
  if (!game) {
    return (
      <CalmCenter>
        <div className="text-center">
          <h1 className="font-display text-5xl font-bold" style={{ color: INK }}>Game not found</h1>
          <p className="mt-3 text-lg" style={{ color: 'oklch(45% 0.025 270)' }}>The game has ended or no longer exists.</p>
          <Link to="/quizzes" className="mt-6 inline-block text-base underline" style={{ color: INK }}>
            Back to library
          </Link>
        </div>
      </CalmCenter>
    )
  }

  if (game && user && game.data.hostId !== user.id) {
    return (
      <CalmCenter>
        <div className="text-center">
          <h1 className="font-display text-5xl font-bold" style={{ color: INK }}>
            Only the host can run this game
          </h1>
          <p className="mt-3 text-lg" style={{ color: 'oklch(45% 0.025 270)' }}>
            Sign in as the host or return to your library.
          </p>
          <Link to="/quizzes" className="mt-6 inline-block text-base underline" style={{ color: INK }}>
            Back to library
          </Link>
        </div>
      </CalmCenter>
    )
  }

  const state = game.data.state
  const idx = game.data.currentQuestionIndex
  const currentQuestion = questions[idx]

  // Stage modes: which states use the dark ink stage vs bone paper
  const isStage = state === 'in_question' || state === 'reveal' || state === 'leaderboard'
  const bg = isStage ? STAGE_INK : STAGE_PAPER

  return (
    <>
      {/* Take over the viewport — hide app chrome */}
      <style>{`
        nav, header[role="banner"] { display: none !important; }
        body { overflow: hidden; }
      `}</style>

      <motion.div
        className="fixed inset-0 z-50 overflow-hidden"
        animate={{ backgroundColor: bg }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        style={{ backgroundColor: bg }}
      >
        <AnimatePresence mode="wait">
          {state === 'lobby' && (
            <motion.div
              key="lobby"
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: EASE_OUT_EXPO }}
            >
              <LobbyView game={game} players={players} onNavigate={navigate} />
            </motion.div>
          )}

          {state === 'in_question' && currentQuestion && (
            <motion.div
              key={`q-${idx}`}
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: EASE_OUT_EXPO }}
            >
              <QuestionView game={game} question={currentQuestion} players={players} phase="in_question" />
            </motion.div>
          )}

          {state === 'reveal' && currentQuestion && (
            <motion.div
              key={`r-${idx}`}
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: EASE_OUT_EXPO }}
            >
              <QuestionView game={game} question={currentQuestion} players={players} phase="reveal" />
            </motion.div>
          )}

          {state === 'leaderboard' && (
            <motion.div
              key={`lb-${idx}`}
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: EASE_OUT_EXPO }}
            >
              <LeaderboardView game={game} players={players} questionIndex={idx} />
            </motion.div>
          )}

          {state === 'ended' && (
            <motion.div
              key="ended"
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: EASE_OUT_EXPO }}
            >
              <EndedView game={game} players={players} navigate={navigate} />
            </motion.div>
          )}

          {(state === 'in_question' || state === 'reveal') && !currentQuestion && (
            <div className="flex h-full items-center justify-center" style={{ color: STAGE_PAPER }}>
              Waiting for question to load…
            </div>
          )}
        </AnimatePresence>
      </motion.div>
    </>
  )
}

function CalmCenter({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`nav, header[role="banner"] { display: none !important; }`}</style>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center px-8"
        style={{ backgroundColor: STAGE_PAPER }}
      >
        {children}
      </div>
    </>
  )
}

// ───────────────────────────────────────────────────────────────────────────
// Lobby
// ───────────────────────────────────────────────────────────────────────────
function LobbyView({
  game,
  players,
  onNavigate,
}: {
  game: RecordRow<Game>
  players: RecordRow<Player>[]
  onNavigate: ReturnType<typeof useNavigate>
}) {
  const [starting, setStarting] = useState(false)
  const pin = game.data.pin
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const joinUrl = `${origin}/play?pin=${pin}`
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=560x560&data=${encodeURIComponent(joinUrl)}`
  const host = origin.replace(/^https?:\/\//, '')

  async function handleStart() {
    if (players.length === 0 || starting) return
    setStarting(true)
    const res = await callAction('startGame', { gameId: game.recordId })
    if (!res.success) setStarting(false)
  }

  async function handleEnd() {
    await callAction('endGame', { gameId: game.recordId })
    onNavigate('/quizzes')
  }

  async function handleKick(playerId: string) {
    await callAction('kickPlayer', { gameId: game.recordId, playerId })
  }

  const pinDigits = pin.split('')

  return (
    <div className="relative h-full w-full overflow-hidden px-[3vw] py-[3vh]" style={{ color: INK }}>
      {/* Decorative drifting shapes — top-right, very low opacity */}
      <div className="pointer-events-none absolute -right-[8vw] -top-[8vh] grid grid-cols-2 gap-[2vw] opacity-[0.06]">
        {SHAPE_COLORS.map((s, i) => (
          <motion.div
            key={s.name}
            animate={{ y: [0, -10, 0], rotate: [0, i % 2 === 0 ? 4 : -4, 0] }}
            transition={{ duration: 8 + i, repeat: Infinity, ease: 'easeInOut', delay: i * 0.4 }}
          >
            <ShapeIcon name={s.name} size={220} color={s.color} />
          </motion.div>
        ))}
      </div>

      {/* Top caption */}
      <div className="flex items-baseline justify-between">
        <p
          className="font-display text-[clamp(20px,2.4vw,34px)] font-medium"
          style={{ color: 'oklch(45% 0.025 270)' }}
        >
          Join at <span style={{ color: INK, fontWeight: 700 }}>{host}/play</span>
        </p>
        <p className="text-[clamp(11px,0.9vw,14px)] uppercase tracking-[0.2em]" style={{ color: 'oklch(45% 0.025 270)' }}>
          Game PIN
        </p>
      </div>

      {/* Massive PIN + QR */}
      <div className="mt-[2vh] flex items-center gap-[3vw]">
        <div className="flex flex-1 gap-[clamp(4px,0.6vw,12px)]">
          {pinDigits.map((d, i) => (
            <motion.div
              key={`${i}-${d}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.04, ease: EASE_OUT_EXPO }}
              className="flex flex-1 items-center justify-center"
              style={{
                aspectRatio: '3 / 4',
                border: `3px solid ${INK}`,
                borderRadius: 18,
                background: 'transparent',
              }}
            >
              <span
                className="font-display tabular font-bold leading-none"
                style={{
                  color: INK,
                  fontSize: 'clamp(72px, 14vw, 220px)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {d}
              </span>
            </motion.div>
          ))}
        </div>

        <div className="flex flex-col items-center" style={{ width: 'clamp(180px, 18vw, 280px)' }}>
          <div
            className="overflow-hidden rounded-2xl bg-white p-[10px]"
            style={{ border: `3px solid ${INK}` }}
          >
            <img src={qrSrc} alt={`QR for ${joinUrl}`} className="h-full w-full" />
          </div>
          <p className="mt-3 text-center text-[clamp(11px,0.85vw,14px)] uppercase tracking-[0.2em]"
             style={{ color: 'oklch(45% 0.025 270)' }}>
            Scan to join
          </p>
        </div>
      </div>

      {/* Players row */}
      <div className="mt-[3vh]">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-[clamp(24px,2.6vw,40px)] font-bold" style={{ color: INK }}>
            Players <span className="tabular" style={{ color: 'oklch(45% 0.025 270)' }}>· {players.length}</span>
          </h2>
          {players.length > 0 ? (
            <span className="text-[clamp(11px,0.85vw,13px)] lowercase tracking-wide" style={{ color: 'oklch(45% 0.025 270)' }}>
              click a tile to remove
            </span>
          ) : null}
        </div>

        <div className="mt-[1.5vh] flex flex-wrap gap-[10px]">
          <AnimatePresence initial={false}>
            {players.map((p) => (
              <motion.button
                key={p.recordId}
                layout
                initial={{ opacity: 0, scale: 0.6, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.5 }}
                transition={{ duration: 0.4, ease: EASE_OUT_EXPO }}
                onClick={() => handleKick(p.recordId)}
                title="Click to remove"
                className="font-display group relative cursor-pointer truncate text-[clamp(15px,1.4vw,22px)] font-bold"
                style={{
                  background: LIME,
                  color: INK,
                  padding: '0.55em 1.1em',
                  borderRadius: 999,
                  border: 'none',
                  letterSpacing: '-0.01em',
                  maxWidth: 280,
                }}
              >
                {p.data.nickname}
              </motion.button>
            ))}
          </AnimatePresence>
          {players.length === 0 ? (
            <motion.div
              animate={{ opacity: [0.45, 0.85, 0.45] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              className="font-display text-[clamp(20px,2vw,32px)]"
              style={{ color: 'oklch(45% 0.025 270)' }}
            >
              waiting for the room to fill…
            </motion.div>
          ) : null}
        </div>
      </div>

      {/* Bottom strip — settings + start */}
      <div className="absolute bottom-[3vh] left-[3vw] right-[3vw] flex items-end justify-between gap-6">
        <div className="font-mono text-[clamp(10px,0.8vw,12px)] lowercase leading-relaxed"
             style={{ color: 'oklch(45% 0.025 270)' }}>
          <div>mode · {game.data.mode === 'live' ? 'live' : 'assignment'}</div>
          <div>scoring · {game.data.scoringMode === 'accuracy' ? 'accuracy' : 'standard'}</div>
          <div>
            streak bonus · {game.data.streakBonusEnabled ? 'on' : 'off'}
            {game.data.teamMode ? '   ·   teams · on' : ''}
          </div>
          <button
            onClick={handleEnd}
            className="mt-2 cursor-pointer underline opacity-70 transition-opacity hover:opacity-100"
            style={{ color: INK, background: 'none', border: 'none', padding: 0, font: 'inherit' }}
          >
            cancel game
          </button>
        </div>

        {players.length === 0 ? (
          <span className="font-display text-[clamp(16px,1.6vw,26px)] font-medium"
                style={{ color: 'oklch(45% 0.025 270)' }}>
            Waiting for players…
          </span>
        ) : (
          <button
            onClick={handleStart}
            disabled={starting}
            className="font-display group relative cursor-pointer font-bold"
            style={{
              background: LIME,
              color: INK,
              fontSize: 'clamp(20px, 2.4vw, 36px)',
              padding: '0.55em 1.4em',
              borderRadius: 16,
              border: `3px solid ${INK}`,
              letterSpacing: '-0.02em',
              boxShadow: `6px 6px 0 ${INK}`,
              transform: starting ? 'translate(3px, 3px)' : 'translate(0, 0)',
              transition: 'transform 120ms ease-out, box-shadow 120ms ease-out',
            }}
          >
            {starting ? 'Starting…' : `Start the show →`}
          </button>
        )}
      </div>
    </div>
  )
}

// ───────────────────────────────────────────────────────────────────────────
// In question / Reveal
// ───────────────────────────────────────────────────────────────────────────
function QuestionView({
  game,
  question,
  players,
  phase,
}: {
  game: RecordRow<Game>
  question: RecordRow<Question>
  players: RecordRow<Player>[]
  phase: 'in_question' | 'reveal'
}) {
  const q = question.data
  const data = useMemo(() => parseQuestion(q), [q])

  const answersQ = useQuery<Answer>('answers', {
    where: { gameId: game.recordId, questionIndex: game.data.currentQuestionIndex },
  })
  const answers = (answersQ.records ?? []) as RecordRow<Answer>[]
  const distinctPlayers = useMemo(() => {
    const set = new Set<string>()
    for (const a of answers) set.add(a.data.playerId)
    return set
  }, [answers])
  const answeredCount = distinctPlayers.size
  const totalPlayers = players.length

  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (phase !== 'in_question') return
    const id = setInterval(() => setNow(Date.now()), 100)
    return () => clearInterval(id)
  }, [phase])

  const startedAt = game.data.currentQuestionStartedAt || now
  const elapsedMs = Math.max(0, now - startedAt)
  const totalSec = Math.max(1, q.timeLimit || 30)
  const remainingMs = Math.max(0, totalSec * 1000 - elapsedMs)
  const remainingSec = Math.ceil(remainingMs / 1000)
  const progress = Math.min(1, elapsedMs / (totalSec * 1000))
  const lowTime = remainingSec <= 5 && phase === 'in_question'

  const allAnswered = totalPlayers > 0 && answeredCount >= totalPlayers
  const timeUp = remainingMs <= 0
  const autoRevealedRef = useRef(false)
  useEffect(() => {
    if (phase !== 'in_question') {
      autoRevealedRef.current = false
      return
    }
    if (autoRevealedRef.current) return
    if (timeUp || allAnswered) {
      autoRevealedRef.current = true
      callAction('revealAnswer', { gameId: game.recordId })
    }
  }, [phase, timeUp, allAnswered, game.recordId])

  const [advancing, setAdvancing] = useState(false)
  async function handleNext() {
    if (advancing) return
    setAdvancing(true)
    if (phase === 'in_question') {
      await callAction('revealAnswer', { gameId: game.recordId })
    } else {
      await callAction('showLeaderboard', { gameId: game.recordId })
    }
    setAdvancing(false)
  }

  return (
    <div className="flex h-full flex-col px-[3vw] pb-[2.5vh] pt-[2vh]" style={{ color: STAGE_PAPER }}>
      {/* Top bar — timer + question label + answered counter */}
      <div className="flex items-center justify-between gap-6">
        <div className="flex items-baseline gap-3">
          <span className="font-mono text-[clamp(11px,0.9vw,13px)] uppercase tracking-[0.25em] opacity-60">
            Question
          </span>
          <span className="font-display tabular text-[clamp(22px,2.2vw,34px)] font-bold">
            {game.data.currentQuestionIndex + 1}
          </span>
        </div>

        {phase === 'in_question' ? (
          <div className="flex items-baseline gap-3">
            <span
              className="font-display tabular text-[clamp(40px,4.2vw,72px)] font-bold leading-none"
              style={{ color: lowTime ? 'var(--kahoot-shape-red)' : LIME }}
            >
              {remainingSec}
            </span>
            <span className="text-[clamp(13px,1vw,16px)] opacity-70">sec</span>
          </div>
        ) : (
          <span
            className="font-display text-[clamp(20px,1.8vw,28px)] font-bold uppercase tracking-[0.2em]"
            style={{ color: LIME }}
          >
            Reveal
          </span>
        )}

        <div className="text-right">
          <div className="font-mono text-[clamp(10px,0.85vw,12px)] uppercase tracking-[0.25em] opacity-60">
            Answered
          </div>
          <div className="font-display tabular text-[clamp(22px,2vw,32px)] font-bold" style={{ color: LIME }}>
            {answeredCount}<span className="opacity-50"> / {totalPlayers}</span>
          </div>
        </div>
      </div>

      {/* Timer bar — empties right to left */}
      {phase === 'in_question' ? (
        <div
          className="mt-[1.5vh] h-[14px] w-full overflow-hidden rounded-full"
          style={{ background: 'rgba(255,255,255,0.08)' }}
        >
          <motion.div
            className="h-full rounded-full"
            style={{
              background: lowTime ? 'var(--kahoot-shape-red)' : LIME,
              width: `${(1 - progress) * 100}%`,
              marginLeft: 'auto',
            }}
            animate={lowTime ? { opacity: [1, 0.55, 1] } : { opacity: 1 }}
            transition={lowTime ? { duration: 0.6, repeat: Infinity, ease: 'easeInOut' } : { duration: 0 }}
          />
        </div>
      ) : (
        <div className="mt-[1.5vh] h-[14px] w-full rounded-full" style={{ background: LIME }} />
      )}

      {/* Question text */}
      <div className="mt-[3vh] flex flex-col items-center justify-center text-center">
        <h1
          className="font-display mx-auto max-w-[80vw] font-bold leading-[1.05]"
          style={{
            color: STAGE_PAPER,
            fontSize: 'clamp(40px, 5.4vw, 100px)',
            letterSpacing: '-0.025em',
            textWrap: 'balance' as React.CSSProperties['textWrap'],
          }}
        >
          {q.text}
        </h1>

        <MediaBlock type={q.mediaType} url={q.mediaUrl} />
      </div>

      {/* Answer area */}
      <div className="mt-auto pt-[2vh]">
        <AnswerArea question={q} data={data} answers={answers} phase={phase} />
      </div>

      {/* Bottom-right next button */}
      <div className="mt-[2vh] flex items-center justify-end">
        <button
          onClick={handleNext}
          disabled={advancing}
          className="font-display cursor-pointer font-bold"
          style={{
            background: LIME,
            color: INK,
            fontSize: 'clamp(16px, 1.6vw, 24px)',
            padding: '0.5em 1.3em',
            borderRadius: 14,
            border: 'none',
            letterSpacing: '-0.02em',
            boxShadow: `4px 4px 0 rgba(255,255,255,0.18)`,
          }}
        >
          {phase === 'in_question' ? 'Reveal →' : 'Next →'}
        </button>
      </div>
    </div>
  )
}

function MediaBlock({ type, url }: { type: string; url: string }) {
  if (!url || type === 'none') return null
  if (type === 'image') {
    return (
      <div className="mt-[2vh] flex justify-center">
        <img
          src={url}
          alt=""
          style={{ maxHeight: '25vh', borderRadius: 16, objectFit: 'contain' }}
        />
      </div>
    )
  }
  if (type === 'video') {
    return (
      <div className="mt-[2vh] flex justify-center">
        <video src={url} controls style={{ maxHeight: '25vh', borderRadius: 16 }} />
      </div>
    )
  }
  if (type === 'audio') {
    return (
      <div className="mt-[2vh] flex justify-center">
        <audio src={url} controls />
      </div>
    )
  }
  if (type === 'youtube') {
    const embed = toYouTubeEmbed(url)
    return (
      <div
        className="mt-[2vh] overflow-hidden"
        style={{ aspectRatio: '16 / 9', maxHeight: '25vh', borderRadius: 16 }}
      >
        <iframe
          src={embed}
          className="h-full w-full"
          allow="accelerometer; autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
        />
      </div>
    )
  }
  return null
}

function toYouTubeEmbed(url: string): string {
  try {
    const u = new URL(url)
    if (u.hostname.includes('youtu.be')) return `https://www.youtube.com/embed${u.pathname}`
    const v = u.searchParams.get('v')
    if (v) return `https://www.youtube.com/embed/${v}`
    return url
  } catch { return url }
}

// ─── answer tiles ─────────────────────────────────────────────────────────
function AnswerArea({
  question,
  data,
  answers,
  phase,
}: {
  question: Question
  data: ParsedQuestionData
  answers: RecordRow<Answer>[]
  phase: 'in_question' | 'reveal'
}) {
  const type = question.type

  const counts = useMemo(() => {
    const m = new Map<number, number>()
    for (const a of answers) {
      const k = a.data.optionIndex
      m.set(k, (m.get(k) ?? 0) + 1)
    }
    return m
  }, [answers])
  const totalAnswers = answers.length

  if (type === 'mcq' || type === 'poll') {
    const opts = data.options ?? []
    return (
      <div className={`grid gap-[12px] ${opts.length <= 2 ? 'grid-cols-2' : 'grid-cols-2'}`}>
        {opts.map((opt, i) => {
          const shape = SHAPE_COLORS[i % SHAPE_COLORS.length]
          const correct = !!opt.correct
          const isReveal = phase === 'reveal'
          const dim = isReveal && type === 'mcq' && !correct
          const ring = isReveal && type === 'mcq' && correct
          const c = counts.get(i) ?? 0
          const pct = totalAnswers ? Math.round((c / totalAnswers) * 100) : 0

          return (
            <motion.div
              key={i}
              layout
              animate={{
                scale: ring ? 1.04 : 1,
                opacity: dim ? 0.18 : 1,
                filter: dim ? 'blur(2px)' : 'blur(0px)',
              }}
              transition={{ duration: 0.6, ease: EASE_OUT_EXPO }}
              className="relative overflow-hidden"
              style={{
                background: shape.color,
                borderRadius: 18,
                padding: 'clamp(14px, 1.4vw, 22px)',
                minHeight: 'clamp(110px, 14vh, 180px)',
                boxShadow: ring ? `0 0 0 8px ${LIME}` : 'none',
              }}
            >
              <div className="flex h-full items-center gap-[clamp(10px,1.2vw,18px)]">
                <div className="flex-shrink-0">
                  <ShapeIcon name={shape.name} size={56} color="#fff" />
                </div>
                <div
                  className="font-display flex-1 font-bold leading-tight"
                  style={{
                    color: '#fff',
                    fontSize: 'clamp(22px, 2.4vw, 40px)',
                    letterSpacing: '-0.02em',
                    textShadow: '0 1px 0 rgba(0,0,0,0.15)',
                  }}
                >
                  {opt.text}
                </div>
                {isReveal ? (
                  <div className="flex flex-shrink-0 flex-col items-end">
                    <div
                      className="font-display tabular font-bold leading-none"
                      style={{ color: '#fff', fontSize: 'clamp(28px, 3vw, 48px)' }}
                    >
                      {pct}%
                    </div>
                    <div
                      className="font-mono leading-none opacity-80"
                      style={{ color: '#fff', fontSize: 'clamp(11px, 0.9vw, 14px)' }}
                    >
                      {c} {c === 1 ? 'vote' : 'votes'}
                    </div>
                  </div>
                ) : null}
              </div>
              {isReveal ? (
                <div
                  className="mt-3 h-[6px] overflow-hidden rounded-full"
                  style={{ background: 'rgba(0,0,0,0.18)' }}
                >
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.7, ease: EASE_OUT_EXPO, delay: 0.2 }}
                    className="h-full"
                    style={{ background: '#fff' }}
                  />
                </div>
              ) : null}
            </motion.div>
          )
        })}
      </div>
    )
  }

  if (type === 'true_false') {
    const correctIdx = data.correctAnswer === true ? 0 : 1
    const labels = ['True', 'False']
    return (
      <div className="grid grid-cols-2 gap-[12px]">
        {labels.map((lbl, i) => {
          const shape = SHAPE_COLORS[TF_SHAPE_INDICES[i]]
          const isCorrect = i === correctIdx
          const isReveal = phase === 'reveal'
          const dim = isReveal && !isCorrect
          const ring = isReveal && isCorrect
          const c = counts.get(i) ?? 0
          const pct = totalAnswers ? Math.round((c / totalAnswers) * 100) : 0
          return (
            <motion.div
              key={i}
              animate={{
                scale: ring ? 1.04 : 1,
                opacity: dim ? 0.18 : 1,
                filter: dim ? 'blur(2px)' : 'blur(0px)',
              }}
              transition={{ duration: 0.6, ease: EASE_OUT_EXPO }}
              className="relative overflow-hidden"
              style={{
                background: shape.color,
                borderRadius: 18,
                padding: 'clamp(18px, 1.8vw, 28px)',
                minHeight: 'clamp(140px, 18vh, 220px)',
                boxShadow: ring ? `0 0 0 8px ${LIME}` : 'none',
              }}
            >
              <div className="flex h-full items-center justify-center gap-[clamp(14px,1.4vw,22px)]">
                <ShapeIcon name={shape.name} size={80} color="#fff" />
                <span
                  className="font-display font-bold"
                  style={{
                    color: '#fff',
                    fontSize: 'clamp(40px, 4vw, 72px)',
                    letterSpacing: '-0.02em',
                    textShadow: '0 1px 0 rgba(0,0,0,0.15)',
                  }}
                >
                  {lbl}
                </span>
                {isReveal ? (
                  <span
                    className="font-display tabular ml-auto font-bold"
                    style={{ color: '#fff', fontSize: 'clamp(28px, 3vw, 48px)' }}
                  >
                    {pct}%
                  </span>
                ) : null}
              </div>
            </motion.div>
          )
        })}
      </div>
    )
  }

  if (type === 'type_answer') {
    if (phase === 'in_question') {
      return (
        <div className="flex items-center justify-center py-[3vh]">
          <div className="flex items-center gap-4">
            <h2
              className="font-display font-bold"
              style={{ color: STAGE_PAPER, fontSize: 'clamp(28px, 3.4vw, 56px)', letterSpacing: '-0.02em' }}
            >
              Players are answering on their phones
            </h2>
            <motion.span
              animate={{ opacity: [0.2, 1, 0.2] }}
              transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
              style={{
                width: 14,
                height: 14,
                borderRadius: 999,
                background: LIME,
                display: 'inline-block',
              }}
            />
          </div>
        </div>
      )
    }
    return (
      <div className="space-y-[2vh]">
        <div
          className="font-display rounded-2xl px-[clamp(20px,2vw,40px)] py-[clamp(20px,2.5vh,40px)] text-center font-bold"
          style={{ background: LIME, color: INK, fontSize: 'clamp(36px, 5vw, 80px)', letterSpacing: '-0.025em' }}
        >
          {String(data.correctAnswer ?? '')}
        </div>
        {answers.length > 0 ? (
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.25em] opacity-60" style={{ color: STAGE_PAPER }}>
              Submissions
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {answers.slice(0, 16).map((a) => (
                <span
                  key={a.recordId}
                  className="rounded-full px-3 py-1 text-[clamp(12px,1.1vw,15px)]"
                  style={{
                    background: a.data.correct ? LIME : 'rgba(255,255,255,0.1)',
                    color: a.data.correct ? INK : STAGE_PAPER,
                    fontWeight: 600,
                  }}
                >
                  {a.data.textAnswer || '—'}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    )
  }

  if (type === 'slider') {
    const min = data.min ?? 0
    const max = data.max ?? 100
    const target = data.target ?? (min + max) / 2
    const range = Math.max(1, max - min)
    if (phase === 'in_question') {
      return (
        <div className="flex items-center justify-center py-[3vh]">
          <div className="flex items-center gap-4">
            <h2
              className="font-display font-bold"
              style={{ color: STAGE_PAPER, fontSize: 'clamp(28px, 3.4vw, 56px)', letterSpacing: '-0.02em' }}
            >
              Players are dialing in a number
            </h2>
            <motion.span
              animate={{ opacity: [0.2, 1, 0.2] }}
              transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
              style={{ width: 14, height: 14, borderRadius: 999, background: LIME, display: 'inline-block' }}
            />
          </div>
        </div>
      )
    }
    return (
      <div>
        <div className="mb-2 flex items-baseline justify-between font-mono text-[clamp(11px,0.9vw,13px)] opacity-70">
          <span className="tabular">{min}</span>
          <span
            className="font-display tabular text-[clamp(20px,1.8vw,28px)] font-bold opacity-100"
            style={{ color: LIME }}
          >
            target · {target}
          </span>
          <span className="tabular">{max}</span>
        </div>
        <div className="relative h-[clamp(40px,6vh,72px)] rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
          <div
            className="absolute top-0 h-full"
            style={{
              left: `${((target - min) / range) * 100}%`,
              width: 4,
              background: LIME,
              transform: 'translateX(-2px)',
            }}
          />
          {answers.map((a) => {
            const v = Math.max(min, Math.min(max, a.data.numberAnswer))
            const left = `${((v - min) / range) * 100}%`
            return (
              <span
                key={a.recordId}
                className="absolute top-1/2"
                style={{
                  left,
                  width: 14,
                  height: 14,
                  borderRadius: 999,
                  background: a.data.correct ? LIME : 'rgba(255,255,255,0.6)',
                  transform: 'translate(-50%, -50%)',
                }}
                title={String(a.data.numberAnswer)}
              />
            )
          })}
        </div>
      </div>
    )
  }

  return null
}

// ───────────────────────────────────────────────────────────────────────────
// Leaderboard
// ───────────────────────────────────────────────────────────────────────────
function LeaderboardView({
  game,
  players,
  questionIndex,
}: {
  game: RecordRow<Game>
  players: RecordRow<Player>[]
  questionIndex: number
}) {
  const answersQ = useQuery<Answer>('answers', {
    where: { gameId: game.recordId, questionIndex },
  })
  const answers = (answersQ.records ?? []) as RecordRow<Answer>[]
  const deltaByPlayer = useMemo(() => {
    const m = new Map<string, number>()
    for (const a of answers) {
      m.set(a.data.playerId, (m.get(a.data.playerId) ?? 0) + a.data.pointsAwarded)
    }
    return m
  }, [answers])

  const ranked = useMemo(
    () => players.slice().sort((a, b) => b.data.score - a.data.score).slice(0, 5),
    [players],
  )

  const [advancing, setAdvancing] = useState(false)
  async function handleNext() {
    if (advancing) return
    setAdvancing(true)
    await callAction('nextQuestion', { gameId: game.recordId })
    setAdvancing(false)
  }

  // size scale for ranks: 1 huge, then descending
  const sizes = ['clamp(56px, 7vw, 110px)', 'clamp(40px, 5vw, 78px)', 'clamp(34px, 4vw, 60px)', 'clamp(28px, 3.2vw, 48px)', 'clamp(24px, 2.8vw, 40px)']

  return (
    <div className="flex h-full flex-col px-[3vw] py-[3vh]" style={{ color: STAGE_PAPER }}>
      <div className="flex items-baseline justify-between">
        <div>
          <p className="font-mono text-[clamp(11px,0.9vw,13px)] uppercase tracking-[0.25em] opacity-60">
            Standings
          </p>
          <h1 className="font-display mt-1 font-bold leading-none" style={{ fontSize: 'clamp(48px,6vw,96px)', letterSpacing: '-0.025em' }}>
            Leaderboard
          </h1>
        </div>
        <span className="font-mono text-[clamp(11px,0.9vw,13px)] opacity-60">
          after question {questionIndex + 1}
        </span>
      </div>

      <ol className="mt-[3vh] flex-1 space-y-[clamp(8px,1.2vh,18px)]">
        {ranked.map((p, i) => {
          const delta = deltaByPlayer.get(p.recordId) ?? 0
          const fontSize = sizes[i] ?? sizes[4]
          const isFirst = i === 0
          const goldGlow = isFirst ? '#F4C95D' : undefined // warm amber, not mustard
          return (
            <motion.li
              key={p.recordId}
              layout
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.08 + i * 0.08, ease: EASE_OUT_EXPO }}
              className="flex items-baseline justify-between gap-[2vw] border-b pb-[clamp(8px,1.2vh,16px)]"
              style={{ borderColor: 'rgba(255,255,255,0.08)' }}
            >
              <div className="flex flex-1 items-baseline gap-[clamp(12px,1.5vw,28px)] min-w-0">
                <span
                  className="font-display tabular flex-shrink-0 font-light leading-none opacity-50"
                  style={{ fontSize, width: 'clamp(48px, 5vw, 90px)' }}
                >
                  {i + 1}
                </span>
                <span
                  className="font-display flex-1 truncate font-bold leading-none"
                  style={{ fontSize, color: goldGlow ?? STAGE_PAPER, letterSpacing: '-0.025em' }}
                >
                  {p.data.nickname}
                </span>
              </div>
              <div className="flex flex-shrink-0 items-baseline gap-[clamp(8px,1vw,18px)]">
                {delta > 0 ? (
                  <span className="font-mono tabular text-[clamp(13px,1.1vw,17px)] font-bold" style={{ color: LIME }}>
                    +{delta}
                  </span>
                ) : (
                  <span className="font-mono tabular text-[clamp(13px,1.1vw,17px)] opacity-40">
                    +0
                  </span>
                )}
                <span
                  className="font-display tabular font-bold leading-none"
                  style={{ fontSize, color: LIME, letterSpacing: '-0.02em' }}
                >
                  {p.data.score.toLocaleString()}
                </span>
              </div>
            </motion.li>
          )
        })}
        {ranked.length === 0 ? (
          <li className="rounded-2xl p-8 text-center opacity-60">No players to rank.</li>
        ) : null}
      </ol>

      <div className="flex items-center justify-end pt-[2vh]">
        <button
          onClick={handleNext}
          disabled={advancing}
          className="font-display cursor-pointer font-bold"
          style={{
            background: LIME,
            color: INK,
            fontSize: 'clamp(16px, 1.6vw, 24px)',
            padding: '0.5em 1.3em',
            borderRadius: 14,
            border: 'none',
            letterSpacing: '-0.02em',
            boxShadow: `4px 4px 0 rgba(255,255,255,0.18)`,
          }}
        >
          Next question →
        </button>
      </div>
    </div>
  )
}

// ───────────────────────────────────────────────────────────────────────────
// Ended (podium)
// ───────────────────────────────────────────────────────────────────────────
function EndedView({
  game,
  players,
  navigate,
}: {
  game: RecordRow<Game>
  players: RecordRow<Player>[]
  navigate: ReturnType<typeof useNavigate>
}) {
  const ranked = useMemo(
    () => players.slice().sort((a, b) => b.data.score - a.data.score),
    [players],
  )
  const podium = ranked.slice(0, 3)
  const rest = ranked.slice(3)

  const [showConfetti, setShowConfetti] = useState(false)
  useEffect(() => {
    // Trigger confetti after the 1st-place pillar has appeared (~800ms delay).
    const t = setTimeout(() => setShowConfetti(true), 1100)
    return () => clearTimeout(t)
  }, [])

  // Display order: 3rd (left), 1st (center), 2nd (right) so 1st is anchored.
  const slots = [
    { rank: 3, player: podium[2], heightVh: 22, delay: 0.2, icon: 'laurel' as const },
    { rank: 1, player: podium[0], heightVh: 42, delay: 0.8, icon: 'crown' as const },
    { rank: 2, player: podium[1], heightVh: 32, delay: 0.4, icon: 'star' as const },
  ].filter(s => !!s.player)

  return (
    <div className="relative flex h-full flex-col px-[3vw] pb-[3vh] pt-[3vh] overflow-y-auto" style={{ color: INK }}>
      {showConfetti ? <Confetti /> : null}

      <div className="text-center">
        <p className="font-mono text-[clamp(11px,0.9vw,13px)] uppercase tracking-[0.3em]" style={{ color: 'oklch(45% 0.025 270)' }}>
          The show is over
        </p>
        <h1
          className="font-display mt-2 font-bold leading-none"
          style={{ fontSize: 'clamp(48px,6vw,108px)', letterSpacing: '-0.03em', color: INK }}
        >
          Final results
        </h1>
      </div>

      {/* Podium */}
      {podium.length > 0 ? (
        <div className="mt-[5vh] flex items-end justify-center gap-[clamp(12px,2vw,40px)]">
          {slots.map((s) => {
            if (!s.player) return null
            const p = s.player
            return (
              <motion.div
                key={p.recordId}
                initial={{ opacity: 0, y: 80 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, ease: EASE_OUT_EXPO, delay: s.delay }}
                className="flex flex-col items-center"
                style={{ width: 'clamp(140px, 16vw, 260px)' }}
              >
                {/* Crown / star / laurel */}
                <div className="mb-2" style={{ color: s.rank === 1 ? '#F4C95D' : INK }}>
                  <PodiumIcon kind={s.icon} size={s.rank === 1 ? 64 : 44} />
                </div>

                {/* Rank number above pillar */}
                <div
                  className="font-display tabular font-bold leading-none"
                  style={{
                    fontSize: s.rank === 1 ? 'clamp(40px,4.4vw,72px)' : 'clamp(28px,3vw,48px)',
                    color: INK,
                    letterSpacing: '-0.02em',
                  }}
                >
                  {s.rank}
                  <span className="text-[0.5em] align-super opacity-60">{ord(s.rank)}</span>
                </div>

                {/* Pillar — lime block with nickname stamped on it */}
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${s.heightVh}vh` }}
                  transition={{ duration: 0.7, ease: EASE_OUT_EXPO, delay: s.delay + 0.15 }}
                  className="mt-3 flex w-full items-start justify-center overflow-hidden"
                  style={{
                    background: LIME,
                    borderTopLeftRadius: 18,
                    borderTopRightRadius: 18,
                    border: `3px solid ${INK}`,
                    borderBottom: 'none',
                  }}
                >
                  <div className="px-3 pt-4 text-center">
                    <div
                      className="font-display font-bold leading-none"
                      style={{
                        fontSize: s.rank === 1 ? 'clamp(20px,2.2vw,36px)' : 'clamp(16px,1.6vw,26px)',
                        color: INK,
                        letterSpacing: '-0.02em',
                        wordBreak: 'break-word',
                      }}
                    >
                      {p.data.nickname}
                    </div>
                    <div
                      className="font-display tabular mt-3 font-bold leading-none"
                      style={{
                        fontSize: s.rank === 1 ? 'clamp(18px,2vw,32px)' : 'clamp(14px,1.4vw,22px)',
                        color: INK,
                      }}
                    >
                      {p.data.score.toLocaleString()} pts
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )
          })}
        </div>
      ) : (
        <div className="mt-[6vh] text-center text-[clamp(16px,1.6vw,22px)]" style={{ color: 'oklch(45% 0.025 270)' }}>
          No players participated.
        </div>
      )}

      {/* Full table */}
      {rest.length > 0 ? (
        <section className="mt-[4vh]">
          <h2 className="font-display text-[clamp(16px,1.4vw,22px)] font-bold" style={{ color: INK }}>
            Full standings
          </h2>
          <ol className="mt-3 overflow-hidden rounded-xl" style={{ border: `2px solid ${INK}` }}>
            {rest.map((p, i) => (
              <li
                key={p.recordId}
                className="flex items-center justify-between px-5 py-3"
                style={{
                  background: i % 2 === 0 ? STAGE_PAPER : 'oklch(95% 0.01 80)',
                  borderTop: i === 0 ? 'none' : `1px solid ${INK}`,
                }}
              >
                <div className="flex items-center gap-4">
                  <span className="font-mono tabular text-[clamp(12px,1vw,14px)] opacity-60" style={{ color: INK, width: 32 }}>
                    #{i + 4}
                  </span>
                  <span className="font-display text-[clamp(15px,1.3vw,20px)] font-bold" style={{ color: INK }}>
                    {p.data.nickname}
                  </span>
                </div>
                <span className="font-display tabular text-[clamp(15px,1.3vw,20px)] font-bold" style={{ color: INK }}>
                  {p.data.score.toLocaleString()}
                </span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {/* Footer actions */}
      <footer className="mt-[3vh] flex flex-wrap items-center justify-center gap-[clamp(8px,1vw,16px)]">
        <button
          onClick={() => navigate(`/reports/${game.recordId}`)}
          className="font-display cursor-pointer font-bold"
          style={{
            background: INK,
            color: STAGE_PAPER,
            fontSize: 'clamp(14px,1.2vw,18px)',
            padding: '0.6em 1.3em',
            borderRadius: 12,
            border: 'none',
            letterSpacing: '-0.01em',
          }}
        >
          View report
        </button>
        <button
          onClick={() => window.open(`/api/reports/${game.recordId}/csv`, '_blank')}
          className="font-display cursor-pointer font-bold"
          style={{
            background: 'transparent',
            color: INK,
            fontSize: 'clamp(14px,1.2vw,18px)',
            padding: '0.6em 1.3em',
            borderRadius: 12,
            border: `2px solid ${INK}`,
            letterSpacing: '-0.01em',
          }}
        >
          Download CSV
        </button>
        <button
          onClick={() => navigate(`/quizzes?host=${game.data.quizId}`)}
          className="font-display cursor-pointer font-bold"
          style={{
            background: 'var(--color-primary)',
            color: INK,
            fontSize: 'clamp(14px,1.2vw,18px)',
            padding: '0.6em 1.3em',
            borderRadius: 12,
            border: `2px solid ${INK}`,
            letterSpacing: '-0.01em',
          }}
        >
          Play again
        </button>
        <button
          onClick={() => navigate('/quizzes')}
          className="font-display cursor-pointer font-bold underline"
          style={{
            background: 'transparent',
            color: INK,
            fontSize: 'clamp(14px,1.2vw,18px)',
            padding: '0.6em 1.3em',
            border: 'none',
            letterSpacing: '-0.01em',
          }}
        >
          Back to library
        </button>
      </footer>
    </div>
  )
}

function ord(n: number): string {
  if (n === 1) return 'st'
  if (n === 2) return 'nd'
  if (n === 3) return 'rd'
  return 'th'
}

// crown / star / laurel — minimal hand-drawn SVGs
function PodiumIcon({ kind, size = 48 }: { kind: 'crown' | 'star' | 'laurel'; size?: number }) {
  if (kind === 'crown') {
    return (
      <svg width={size} height={size} viewBox="0 0 64 64" fill="currentColor" aria-hidden>
        <path d="M6 50 L10 22 L22 34 L32 14 L42 34 L54 22 L58 50 Z" />
        <rect x="6" y="50" width="52" height="6" rx="2" />
        <circle cx="10" cy="22" r="3" />
        <circle cx="32" cy="14" r="3" />
        <circle cx="54" cy="22" r="3" />
      </svg>
    )
  }
  if (kind === 'star') {
    return (
      <svg width={size} height={size} viewBox="0 0 64 64" fill="currentColor" aria-hidden>
        <polygon points="32,6 39,24 58,26 43,38 48,57 32,46 16,57 21,38 6,26 25,24" />
      </svg>
    )
  }
  // laurel — two simple branches
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden>
      <path d="M14 50 Q10 38 14 20" />
      <path d="M50 50 Q54 38 50 20" />
      <path d="M14 22 Q10 22 8 18" />
      <path d="M16 32 Q12 32 10 28" />
      <path d="M16 42 Q12 42 10 38" />
      <path d="M50 22 Q54 22 56 18" />
      <path d="M48 32 Q52 32 54 28" />
      <path d="M48 42 Q52 42 54 38" />
    </svg>
  )
}

// Tasteful confetti — small SVG burst, no canvas library
function Confetti() {
  const pieces = useMemo(() => {
    const out: { x: number; rot: number; color: string; delay: number; shape: string }[] = []
    const colors = [
      'var(--kahoot-shape-red)',
      'var(--kahoot-shape-blue)',
      'var(--kahoot-shape-yellow)',
      'var(--kahoot-shape-green)',
      LIME,
    ]
    const shapes = ['triangle', 'diamond', 'circle', 'square']
    for (let i = 0; i < 36; i++) {
      out.push({
        x: Math.random() * 100,
        rot: Math.random() * 360,
        color: colors[i % colors.length],
        delay: Math.random() * 0.3,
        shape: shapes[i % shapes.length],
      })
    }
    return out
  }, [])

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map((p, i) => (
        <motion.div
          key={i}
          initial={{ y: -40, x: `${p.x}vw`, rotate: p.rot, opacity: 1 }}
          animate={{ y: '60vh', rotate: p.rot + 200, opacity: 0 }}
          transition={{ duration: 2.4, delay: p.delay, ease: [0.16, 1, 0.3, 1] }}
          style={{ position: 'absolute', top: 0, color: p.color }}
        >
          <ShapeIcon name={p.shape} size={14} color={p.color} />
        </motion.div>
      ))}
    </div>
  )
}
