import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useUser } from 'deepspace'
import { ArrowLeft, Check, Copy, Download, Loader2, ShieldAlert } from 'lucide-react'
import { EmptyState } from '../../../components/ui'
import type { Answer, Game, Player, Question, Quiz } from '../../../lib/types'
import {
  QUESTION_TYPES,
  type McqData,
  type PollData,
  type QuestionType,
  type TrueFalseData,
} from '../../../lib/quiz-types'

interface PlayerStats {
  recordId: string
  nickname: string
  score: number
  accuracy: number
  avgResponseMs: number
  rank: number
}

interface QuestionStats {
  recordId: string
  index: number
  text: string
  type: string
  data: string
  correctRate: number
  avgResponseMs: number
  optionCounts: number[]
  optionLabels: string[]
  totalAnswers: number
}

const SHAPE_COLORS = [
  'var(--kahoot-shape-red)',
  'var(--kahoot-shape-blue)',
  'var(--kahoot-shape-yellow)',
  'var(--kahoot-shape-green)',
]

export default function ReportDetailPage() {
  const navigate = useNavigate()
  const { gameId = '' } = useParams<{ gameId: string }>()
  const { user } = useUser()
  const userId = user?.id ?? ''

  const gameQ = useQuery<Game>('games', { where: { recordId: gameId } })
  const game = gameQ.records?.[0]

  const playersQ = useQuery<Player>('players', { where: { gameId } })
  const answersQ = useQuery<Answer>('answers', { where: { gameId } })
  const quizzesQ = useQuery<Quiz>('quizzes', {
    where: game ? { recordId: game.data.quizId } : undefined,
  })
  const questionsQ = useQuery<Question>('questions', {
    where: game ? { quizId: game.data.quizId } : undefined,
  })

  const quiz = quizzesQ.records?.[0]?.data

  const questions = useMemo(() => {
    return [...(questionsQ.records ?? [])].sort((a, b) => a.data.order - b.data.order)
  }, [questionsQ.records])

  const playerStats = useMemo<PlayerStats[]>(() => {
    const totalQuestions = questions.length
    const answersByPlayer = new Map<string, Answer[]>()
    for (const a of answersQ.records ?? []) {
      const list = answersByPlayer.get(a.data.playerId) ?? []
      list.push(a.data)
      answersByPlayer.set(a.data.playerId, list)
    }

    const stats = (playersQ.records ?? [])
      .filter((p) => !p.data.kicked)
      .map((p) => {
        const answers = answersByPlayer.get(p.recordId) ?? []
        const correctCount = answers.filter((a) => a.correct).length
        const totalRt = answers.reduce((sum, a) => sum + (a.responseTimeMs ?? 0), 0)
        return {
          recordId: p.recordId,
          nickname: p.data.nickname,
          score: p.data.score,
          accuracy: totalQuestions > 0 ? correctCount / totalQuestions : 0,
          avgResponseMs: answers.length > 0 ? totalRt / answers.length : 0,
          rank: 0,
        }
      })
      .sort((a, b) => b.score - a.score)

    stats.forEach((s, i) => (s.rank = i + 1))
    return stats
  }, [playersQ.records, answersQ.records, questions.length])

  const questionStats = useMemo<QuestionStats[]>(() => {
    const answersByQ = new Map<number, Answer[]>()
    for (const a of answersQ.records ?? []) {
      const list = answersByQ.get(a.data.questionIndex) ?? []
      list.push(a.data)
      answersByQ.set(a.data.questionIndex, list)
    }

    return questions.map((q, i) => {
      const answers = answersByQ.get(i) ?? []
      const total = answers.length
      const correct = answers.filter((a) => a.correct).length
      const totalRt = answers.reduce((sum, a) => sum + (a.responseTimeMs ?? 0), 0)
      const { counts, labels } = optionDistribution(q.data.type, q.data.data, answers)
      return {
        recordId: q.recordId,
        index: i,
        text: q.data.text,
        type: q.data.type,
        data: q.data.data,
        correctRate: total > 0 ? correct / total : 0,
        avgResponseMs: total > 0 ? totalRt / total : 0,
        optionCounts: counts,
        optionLabels: labels,
        totalAnswers: total,
      }
    })
  }, [questions, answersQ.records])

  const overall = useMemo(() => {
    let total = 0
    let correct = 0
    for (const a of answersQ.records ?? []) {
      total += 1
      if (a.data.correct) correct += 1
    }
    return total > 0 ? correct / total : 0
  }, [answersQ.records])

  const loading =
    gameQ.status === 'loading' ||
    playersQ.status === 'loading' ||
    answersQ.status === 'loading' ||
    quizzesQ.status === 'loading' ||
    questionsQ.status === 'loading'

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    )
  }

  if (!game || game.data.hostId !== userId) {
    return (
      <div className="min-h-full bg-background">
        <div className="mx-auto max-w-3xl px-6 py-20">
          <EmptyState
            icon={<ShieldAlert className="h-6 w-6" />}
            title="Report not found"
            description="This game doesn't exist or wasn't hosted by you."
            action={{ label: 'Back to reports', onClick: () => navigate('/reports') }}
          />
        </div>
      </div>
    )
  }

  const csvUrl = `/api/reports/${gameId}/csv`
  const overallPct = Math.round(overall * 100)

  return (
    <div className="min-h-full bg-background text-foreground">
      <div className="mx-auto max-w-5xl px-6 py-10 sm:py-14">
        <button
          onClick={() => navigate('/reports')}
          className="mb-8 inline-flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All reports
        </button>

        {/* HEADER */}
        <header className="mb-12 flex flex-wrap items-start justify-between gap-6 border-b border-border pb-10">
          <div className="min-w-0">
            <p className="mb-1 text-[11.5px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Post-game recap
            </p>
            <h1
              className="font-display font-semibold leading-[1.02] tracking-tight"
              style={{ fontSize: 'clamp(2rem, 5vw, 3.25rem)', letterSpacing: '-0.03em' }}
            >
              {quiz?.title ?? 'Untitled quiz'}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] tabular text-muted-foreground">
              <span>{headerDate(game.data)}</span>
              <span className="text-border">·</span>
              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 text-[11px] uppercase tracking-wider">
                {game.data.mode === 'assignment' ? 'Async' : 'Live'}
              </span>
            </div>
          </div>
          <a href={csvUrl} target="_blank" rel="noopener noreferrer" className="shrink-0">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-foreground px-4 py-2 text-[13px] font-semibold text-foreground transition-colors hover:bg-foreground hover:text-background">
              <Download className="h-3.5 w-3.5" />
              Download CSV
            </span>
          </a>
        </header>

        {/* Share — hosts who lost the assignment link can recover it here. */}
        <ShareLinkCard pin={game.data.pin} mode={game.data.mode} ended={game.data.state === 'ended'} />

        {/* HEADLINE STAT */}
        <section className="mb-16">
          <div className="grid grid-cols-1 items-end gap-8 md:grid-cols-[auto_1fr]">
            <div>
              <p className="mb-2 text-[11.5px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                Class accuracy
              </p>
              <div className="font-display flex items-start font-semibold leading-[0.85] tracking-[-0.04em] text-foreground">
                <span
                  className="tabular"
                  style={{
                    fontSize: 'clamp(5rem, 16vw, 11rem)',
                  }}
                >
                  {overallPct}
                </span>
                <span
                  className="ml-1 mt-2 text-primary"
                  style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)' }}
                >
                  %
                </span>
              </div>
            </div>
            <div className="md:pb-6">
              <p className="text-[14.5px] leading-relaxed text-muted-foreground">
                <span className="text-foreground font-medium">{playerStats.length}</span>{' '}
                {playerStats.length === 1 ? 'player' : 'players'}
                <span className="mx-2 text-border">·</span>
                <span className="text-foreground font-medium">{questions.length}</span>{' '}
                {questions.length === 1 ? 'question' : 'questions'}
                <span className="mx-2 text-border">·</span>
                {game.data.state === 'ended'
                  ? `played ${relativeDate(game.data.endedAt)}`
                  : 'in progress'}
              </p>
              {/* Distribution glance — bar of correct vs incorrect */}
              <div className="mt-4 h-[10px] w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full bg-primary transition-[width] duration-1000"
                  style={{ width: `${overallPct}%` }}
                />
              </div>
            </div>
          </div>
        </section>

        {/* LEADERBOARD — typographic */}
        <section className="mb-20">
          <div className="mb-5 flex items-baseline justify-between">
            <h2 className="font-display text-[1.5rem] font-semibold tracking-tight">
              Leaderboard
            </h2>
            <span className="text-[11.5px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {playerStats.length} {playerStats.length === 1 ? 'player' : 'players'}
            </span>
          </div>
          {playerStats.length === 0 ? (
            <p className="border-y border-border py-8 text-center text-[14px] text-muted-foreground">
              No players joined this game.
            </p>
          ) : (
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-border text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  <th className="py-2.5 pr-4 font-medium">#</th>
                  <th className="py-2.5 pr-4 font-medium">Nickname</th>
                  <th className="py-2.5 pr-4 text-right font-medium">Score</th>
                  <th className="py-2.5 pr-4 text-right font-medium">Accuracy</th>
                  <th className="py-2.5 text-right font-medium">Avg time</th>
                </tr>
              </thead>
              <tbody>
                {playerStats.map((p) => {
                  const top = p.rank === 1
                  return (
                    <tr
                      key={p.recordId}
                      className="border-b border-border/60 transition-colors hover:bg-secondary/30"
                    >
                      <td className="py-4 pr-4">
                        <span
                          className={
                            'font-display tabular text-[1.25rem] font-semibold tracking-tight ' +
                            (top ? 'text-foreground' : 'text-muted-foreground')
                          }
                          style={top ? { color: 'var(--kahoot-shape-yellow)' } : undefined}
                        >
                          {p.rank.toString().padStart(2, '0')}
                        </span>
                      </td>
                      <td className="py-4 pr-4">
                        <span className="font-display text-[1.05rem] font-semibold tracking-tight">
                          {p.nickname}
                        </span>
                      </td>
                      <td className="py-4 pr-4 text-right tabular font-medium">
                        {p.score.toLocaleString()}
                      </td>
                      <td className="py-4 pr-4 text-right tabular text-muted-foreground">
                        {Math.round(p.accuracy * 100)}%
                      </td>
                      <td className="py-4 text-right tabular text-muted-foreground">
                        {formatMs(p.avgResponseMs)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </section>

        {/* PER QUESTION — alternating diagonal layout */}
        <section>
          <div className="mb-6 flex items-baseline justify-between">
            <h2 className="font-display text-[1.5rem] font-semibold tracking-tight">
              Per question
            </h2>
            <span className="text-[11.5px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {questionStats.length} {questionStats.length === 1 ? 'item' : 'items'}
            </span>
          </div>
          {questionStats.length === 0 ? (
            <p className="border-y border-border py-8 text-center text-[14px] text-muted-foreground">
              No questions on this quiz.
            </p>
          ) : (
            <div className="space-y-12">
              {questionStats.map((q, i) => (
                <QuestionSpread key={q.recordId} q={q} alignRight={i % 2 === 1} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function QuestionSpread({
  q,
  alignRight,
}: {
  q: QuestionStats
  alignRight: boolean
}) {
  const tough = q.totalAnswers > 0 && q.correctRate < 0.4
  const showDistribution =
    q.optionLabels.length > 0 &&
    (q.type === QUESTION_TYPES.MCQ ||
      q.type === QUESTION_TYPES.POLL ||
      q.type === QUESTION_TYPES.TRUE_FALSE)
  const maxCount = Math.max(1, ...q.optionCounts)
  const pct = q.totalAnswers > 0 ? Math.round(q.correctRate * 100) : null

  return (
    <article
      className={
        'grid grid-cols-1 gap-8 md:grid-cols-12 ' +
        (alignRight ? 'md:[&>*:first-child]:order-2' : '')
      }
    >
      {/* HEADER COL */}
      <header
        className={
          'md:col-span-5 ' + (alignRight ? 'md:text-right' : '')
        }
      >
        <div
          className={
            'flex items-baseline gap-3 ' +
            (alignRight ? 'md:justify-end' : '')
          }
        >
          <span className="font-display tabular text-[2.75rem] font-semibold leading-none tracking-[-0.03em] text-foreground">
            {String(q.index + 1).padStart(2, '0')}
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            {q.type.replace('_', ' ')}
          </span>
        </div>
        <h3 className="font-display mt-3 text-[1.4rem] font-semibold leading-[1.15] tracking-tight text-foreground">
          {q.text || `Question ${q.index + 1}`}
        </h3>

        <div
          className={
            'mt-4 inline-flex items-center gap-2 ' +
            (alignRight ? 'md:flex-row-reverse' : '')
          }
        >
          {tough ? (
            <Pill tone="lime">Reteach</Pill>
          ) : pct !== null ? (
            <Pill tone="muted">Solid</Pill>
          ) : null}
          {pct !== null && (
            <span className="font-display tabular text-[15px] font-semibold tracking-tight text-foreground">
              {pct}% correct
            </span>
          )}
          <span className="text-[12px] tabular text-muted-foreground">
            · {formatMs(q.avgResponseMs)} avg · {q.totalAnswers} responses
          </span>
        </div>
      </header>

      {/* DISTRIBUTION COL */}
      <div className="md:col-span-7">
        {showDistribution ? (
          <ul className="space-y-3">
            {q.optionLabels.map((label, i) => {
              const count = q.optionCounts[i] ?? 0
              const widthPct = (count / maxCount) * 100
              return (
                <li key={i} className="grid grid-cols-[1fr_auto] items-center gap-3">
                  <div>
                    <div className="mb-1 flex items-baseline justify-between gap-3">
                      <span className="line-clamp-1 text-[13.5px] font-medium text-foreground">
                        {label}
                      </span>
                      <span className="tabular text-[12px] text-muted-foreground">
                        {count}
                      </span>
                    </div>
                    <div className="h-4 w-full overflow-hidden rounded-sm bg-secondary">
                      <div
                        className="h-full transition-[width] duration-700"
                        style={{
                          width: `${widthPct}%`,
                          backgroundColor: SHAPE_COLORS[i % 4],
                        }}
                      />
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-[13px] text-muted-foreground">
            No per-option distribution for this type.
          </p>
        )}
      </div>
    </article>
  )
}

function Pill({
  children,
  tone,
}: {
  children: React.ReactNode
  tone: 'lime' | 'muted'
}) {
  return (
    <span
      className={
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] ' +
        (tone === 'lime'
          ? 'bg-primary text-primary-foreground'
          : 'border border-border bg-background text-muted-foreground')
      }
    >
      {children}
    </span>
  )
}

function optionDistribution(
  type: string,
  dataJson: string,
  answers: Answer[],
): { counts: number[]; labels: string[] } {
  const labels = optionLabels(type as QuestionType, dataJson)
  if (labels.length === 0) return { counts: [], labels: [] }
  const counts = new Array(labels.length).fill(0)
  for (const a of answers) {
    const idx = a.optionIndex
    if (idx >= 0 && idx < counts.length) counts[idx]++
  }
  return { counts, labels }
}

function optionLabels(type: QuestionType, dataJson: string): string[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(dataJson || '{}')
  } catch {
    return []
  }
  if (type === QUESTION_TYPES.MCQ) {
    const d = parsed as McqData
    return (d.options ?? []).map((o, i) => o.text || `Option ${i + 1}`)
  }
  if (type === QUESTION_TYPES.POLL) {
    const d = parsed as PollData
    return (d.options ?? []).map((o, i) => o.text || `Option ${i + 1}`)
  }
  if (type === QUESTION_TYPES.TRUE_FALSE) {
    const d = parsed as TrueFalseData
    void d
    return ['True', 'False']
  }
  return []
}

function formatDate(ts: number): string {
  if (!ts) return 'Unknown date'
  return new Date(ts).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

// Header date line: ended games show when they ended; live games never reach
// reports until ended; in-progress assignments show their deadline or 'In
// progress' so we don't print "Unknown date".
function headerDate(g: Game): string {
  if (g.state === 'ended') return formatDate(g.endedAt)
  if (g.mode === 'assignment') {
    return g.deadlineAt > 0
      ? `Due ${formatDate(g.deadlineAt)}`
      : 'In progress'
  }
  return 'In progress'
}

function relativeDate(ts: number): string {
  if (!ts) return 'recently'
  const now = Date.now()
  const diff = now - ts
  const day = 86_400_000
  if (diff < day) return 'today'
  if (diff < 2 * day) return 'yesterday'
  if (diff < 7 * day) {
    const dow = new Date(ts).toLocaleString(undefined, { weekday: 'long' })
    return dow
  }
  return new Date(ts).toLocaleString(undefined, { month: 'short', day: 'numeric' })
}

function formatMs(ms: number): string {
  if (!ms || ms <= 0) return '—'
  if (ms < 1000) return `${Math.round(ms)}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

/**
 * Share link block. Hosts who created an assignment, lost the join URL, and
 * came back to the report should be able to copy it again. Always rendered
 * for assignment games; for live games we only show it while the game is
 * still active (after end, the PIN is dead anyway).
 */
function ShareLinkCard({
  pin,
  mode,
  ended,
}: {
  pin: string
  mode: string
  ended: boolean
}) {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const url = pin ? `${origin}/play/${pin}` : ''
  const [copied, setCopied] = useState(false)

  if (!url) return null
  if (mode !== 'assignment' && ended) return null

  async function copy() {
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      // ignore — older browsers / blocked permission. The link is visible
      // on screen so the host can long-press to copy manually.
    }
  }

  return (
    <section className="mb-12 -mt-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            {ended ? 'Was joined at' : 'Share link'}
          </p>
          <p className="font-display tabular mt-1 truncate text-[15px] font-medium text-foreground">
            {url}
          </p>
          <p className="mt-1 text-[12px] tabular text-muted-foreground">
            PIN <span className="font-semibold text-foreground">{pin}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={copy}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-foreground px-4 py-2 text-[13px] font-semibold text-foreground transition-colors hover:bg-foreground hover:text-background"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5" />
              Copied
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              Copy link
            </>
          )}
        </button>
      </div>
    </section>
  )
}
