import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useUser } from 'deepspace'
import { ChevronRight, Loader2 } from 'lucide-react'
import { EmptyState } from '../../../components/ui'
import type { Answer, Game, Player, Quiz } from '../../../lib/types'

interface GameRow {
  recordId: string
  game: Game
  quizTitle: string
  playerCount: number
  winnerNickname: string | null
  correctRate: number
}

export default function ReportsIndexPage() {
  const navigate = useNavigate()
  const { user } = useUser()
  const userId = user?.id ?? ''

  const gamesQ = useQuery<Game>('games', { orderBy: 'endedAt', orderDir: 'desc' })
  const quizzesQ = useQuery<Quiz>('quizzes')
  const playersQ = useQuery<Player>('players')
  const answersQ = useQuery<Answer>('answers')

  const rows = useMemo<GameRow[]>(() => {
    const quizzes = new Map<string, Quiz>()
    for (const q of quizzesQ.records ?? []) quizzes.set(q.recordId, q.data)

    const playersByGame = new Map<string, Player[]>()
    for (const p of playersQ.records ?? []) {
      if (p.data.kicked) continue
      const list = playersByGame.get(p.data.gameId) ?? []
      list.push(p.data)
      playersByGame.set(p.data.gameId, list)
    }

    const answersByGame = new Map<string, { total: number; correct: number }>()
    for (const a of answersQ.records ?? []) {
      const stat = answersByGame.get(a.data.gameId) ?? { total: 0, correct: 0 }
      stat.total += 1
      if (a.data.correct) stat.correct += 1
      answersByGame.set(a.data.gameId, stat)
    }

    const out: GameRow[] = []
    for (const g of gamesQ.records ?? []) {
      if (g.data.hostId !== userId) continue
      if (g.data.state !== 'ended') continue
      const players = playersByGame.get(g.recordId) ?? []
      const winner = players.length
        ? [...players].sort((a, b) => b.score - a.score)[0]
        : null
      const stat = answersByGame.get(g.recordId)
      const rate = stat && stat.total > 0 ? stat.correct / stat.total : 0
      out.push({
        recordId: g.recordId,
        game: g.data,
        quizTitle: quizzes.get(g.data.quizId)?.title ?? 'Untitled quiz',
        playerCount: players.length,
        winnerNickname: winner?.nickname ?? null,
        correctRate: rate,
      })
    }
    out.sort((a, b) => (b.game.endedAt ?? 0) - (a.game.endedAt ?? 0))
    return out
  }, [gamesQ.records, quizzesQ.records, playersQ.records, answersQ.records, userId])

  const loading =
    gamesQ.status === 'loading' ||
    quizzesQ.status === 'loading' ||
    playersQ.status === 'loading' ||
    answersQ.status === 'loading'

  return (
    <div className="min-h-full bg-background text-foreground">
      <div className="mx-auto max-w-5xl px-6 py-12 sm:py-16">
        <header className="mb-12">
          <p className="mb-1 text-[12px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Recap
          </p>
          <h1
            className="font-display font-semibold tracking-tight"
            style={{ fontSize: 'clamp(2.25rem, 5vw, 3.75rem)', letterSpacing: '-0.03em' }}
          >
            Reports.
          </h1>
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
            One row per game. Skim accuracy, scan winners, then click in to see
            the question-by-question recap.
          </p>
        </header>

        {loading ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            title="No games played yet"
            description="Once you host a kahoot and end the game, the report will show up here."
          />
        ) : (
          <ul role="list" className="border-t border-border">
            {rows.map((r) => (
              <ReportRow
                key={r.recordId}
                row={r}
                onOpen={() => navigate(`/reports/${r.recordId}`)}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function ReportRow({ row, onOpen }: { row: GameRow; onOpen: () => void }) {
  const pct = Math.round(row.correctRate * 100)
  return (
    <li>
      <button
        onClick={onOpen}
        className="group grid w-full grid-cols-1 items-center gap-4 border-b border-border py-6 text-left transition-colors hover:bg-secondary/30 sm:grid-cols-[7rem_1fr_auto] sm:gap-8 sm:px-2"
      >
        {/* Date */}
        <div className="tabular text-[13px] text-muted-foreground">
          <div className="font-medium uppercase tracking-wide text-foreground/80">
            {formatShortDate(row.game.endedAt)}
          </div>
          <div className="text-[11.5px]">{formatTime(row.game.endedAt)}</div>
        </div>

        {/* Title + bar + meta */}
        <div className="min-w-0">
          <h3 className="font-display line-clamp-1 text-[1.4rem] font-semibold leading-tight tracking-tight text-foreground transition-colors group-hover:text-foreground">
            {row.quizTitle}
          </h3>

          {/* Mini correct% bar */}
          <div className="mt-3 flex items-center gap-3">
            <div className="relative h-2 flex-1 max-w-md overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full bg-primary transition-[width] duration-700"
                style={{
                  width: `${pct}%`,
                  backgroundColor: 'var(--color-primary)',
                  boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.04)',
                }}
              />
              <div
                className="absolute inset-y-0 right-0 w-px bg-foreground/10"
                aria-hidden
              />
            </div>
            <span className="font-display tabular w-12 shrink-0 text-right text-[15px] font-semibold tracking-tight text-foreground">
              {pct}%
            </span>
          </div>

          <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] tabular text-muted-foreground">
            <span>
              <span className="text-foreground font-medium">{row.playerCount}</span>{' '}
              {row.playerCount === 1 ? 'player' : 'players'}
            </span>
            {row.winnerNickname && (
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="inline-block h-2 w-2 rotate-45"
                  style={{ backgroundColor: 'var(--kahoot-shape-yellow)' }}
                  aria-hidden
                />
                Winner
                <span className="text-foreground font-medium">{row.winnerNickname}</span>
              </span>
            )}
            <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 text-[11px] uppercase tracking-wider">
              {row.game.mode === 'assignment' ? 'Async' : 'Live'}
            </span>
          </div>
        </div>

        <ChevronRight className="hidden h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground sm:block" />
      </button>
    </li>
  )
}

function formatShortDate(ts: number): string {
  if (!ts) return '—'
  const d = new Date(ts)
  return d.toLocaleString(undefined, { month: 'short', day: '2-digit' })
}
function formatTime(ts: number): string {
  if (!ts) return ''
  return new Date(ts).toLocaleString(undefined, { hour: 'numeric', minute: '2-digit' })
}
