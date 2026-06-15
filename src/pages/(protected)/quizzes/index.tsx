import { useMemo, useState, useRef, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useUser, getAuthToken } from 'deepspace'
import {
  Plus,
  Sparkles,
  Link as LinkIcon,
  Pencil,
  Copy,
  Trash2,
  MoreHorizontal,
  Loader2,
  ArrowRight,
  Send,
  CalendarClock,
  Check as CheckIcon,
} from 'lucide-react'
import { Modal, Button, Input, Textarea, ConfirmModal, useToast, Switch } from '../../../components/ui'
import { callAction } from '../../../lib/actions-client'
import type { Quiz, Question } from '../../../lib/types'
import {
  QUESTION_TYPE_LABELS,
  type QuestionType,
} from '../../../lib/quiz-types'

type CreateMode = 'blank' | 'topic' | 'url'

interface DraftAiQuestion {
  type: QuestionType
  text: string
  timeLimit: number
  options?: { text: string; correct: boolean }[]
  correctAnswer?: string | boolean
}

interface QuizRow {
  recordId: string
  data: Quiz
}

export default function QuizzesIndexPage() {
  const navigate = useNavigate()
  const { user } = useUser()
  const userId = user?.id ?? ''

  const quizzesQ = useQuery<Quiz>('quizzes', { orderBy: 'createdAt', orderDir: 'desc' })
  const questionsQ = useQuery<Question>('questions')

  const myQuizzes = useMemo<QuizRow[]>(() => {
    return (quizzesQ.records ?? [])
      .filter((r) => r.data.ownerId === userId)
      .map((r) => ({ recordId: r.recordId, data: r.data }))
  }, [quizzesQ.records, userId])

  const questionsByQuiz = useMemo(() => {
    const map = new Map<string, number>()
    for (const q of questionsQ.records ?? []) {
      map.set(q.data.quizId, (map.get(q.data.quizId) ?? 0) + 1)
    }
    return map
  }, [questionsQ.records])

  const [createOpen, setCreateOpen] = useState(false)
  const [createSeedMode, setCreateSeedMode] = useState<CreateMode>('blank')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [hostSetupQuizId, setHostSetupQuizId] = useState<string | null>(null)
  const [assignmentQuizId, setAssignmentQuizId] = useState<string | null>(null)

  // Deep-link from quiz editor: /quizzes?host=<quizId> → open the setup modal.
  const [searchParams, setSearchParams] = useSearchParams()
  useEffect(() => {
    const qid = searchParams.get('host')
    if (qid && myQuizzes.some((q) => q.recordId === qid)) {
      setHostSetupQuizId(qid)
      const next = new URLSearchParams(searchParams)
      next.delete('host')
      setSearchParams(next, { replace: true })
    }
  }, [searchParams, myQuizzes, setSearchParams])

  function openCreate(mode: CreateMode = 'blank') {
    setCreateSeedMode(mode)
    setCreateOpen(true)
  }

  const { error: toastError, success: toastSuccess } = useToast()

  async function startGameWithSettings(quizId: string, settings: GameSettings) {
    setBusyId(quizId)
    const res = await callAction<{ recordId: string }>('createGame', {
      quizId,
      mode: 'live',
      ...settings,
    })
    setBusyId(null)
    setHostSetupQuizId(null)
    if (res.success && res.data) {
      navigate(`/host/${res.data.recordId}`)
    } else {
      toastError("Couldn't start game", res.error ?? 'Try again in a moment.')
    }
  }

  async function createAssignment(quizId: string, deadlineAt: number, settings: GameSettings) {
    setBusyId(quizId)
    const res = await callAction<{ recordId: string }>('createGame', {
      quizId,
      mode: 'assignment',
      deadlineAt,
      ...settings,
    })
    setBusyId(null)
    if (res.success && res.data) {
      return res.data.recordId
    }
    toastError("Couldn't create assignment", res.error ?? 'Try again in a moment.')
    return null
  }

  async function handleDuplicate(quizId: string) {
    setBusyId(quizId)
    const res = await callAction<{ recordId: string }>('duplicateQuiz', { quizId })
    setBusyId(null)
    if (res.success) toastSuccess('Duplicated', 'A copy is in your library.')
    else toastError("Couldn't duplicate", res.error ?? 'Try again.')
  }

  async function handleDelete(quizId: string) {
    setBusyId(quizId)
    const res = await callAction('deleteQuiz', { quizId })
    setBusyId(null)
    setConfirmDelete(null)
    if (res.success) toastSuccess('Deleted', 'The quiz is gone.')
    else toastError("Couldn't delete", res.error ?? 'Try again.')
  }

  const totalCount = myQuizzes.length
  const totalQuestions = useMemo(
    () => myQuizzes.reduce((acc, q) => acc + (questionsByQuiz.get(q.recordId) ?? 0), 0),
    [myQuizzes, questionsByQuiz],
  )

  const loading = quizzesQ.status === 'loading'
  const isEmpty = !loading && totalCount === 0

  return (
    <div className="min-h-full bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-6 py-12 sm:py-16">
        {/* HEADER */}
        <header className="mb-12 flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="mb-1 text-[12px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Library
            </p>
            <h1
              className="font-display font-semibold tracking-tight"
              style={{ fontSize: 'clamp(2.25rem, 5vw, 3.75rem)', letterSpacing: '-0.03em' }}
            >
              Your quizzes.
            </h1>
            {!loading && !isEmpty && (
              <p className="mt-2 text-[14px] tabular text-muted-foreground">
                <span className="text-foreground font-medium">{totalCount}</span>{' '}
                {totalCount === 1 ? 'quiz' : 'quizzes'}
                <span className="mx-2 text-border">·</span>
                <span className="text-foreground font-medium">{totalQuestions}</span>{' '}
                {totalQuestions === 1 ? 'question' : 'questions'} authored
              </p>
            )}
          </div>
        </header>

        {loading ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : isEmpty ? (
          <EmptyAuthor onSeed={openCreate} />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <NewQuizTile onClick={() => openCreate('blank')} />
            {myQuizzes.map((q) => (
              <QuizCard
                key={q.recordId}
                quizId={q.recordId}
                quiz={q.data}
                questionCount={questionsByQuiz.get(q.recordId) ?? 0}
                busy={busyId === q.recordId}
                onEdit={() => navigate(`/quizzes/${q.recordId}/edit`)}
                onDuplicate={() => handleDuplicate(q.recordId)}
                onDelete={() => setConfirmDelete(q.recordId)}
                onHost={() => setHostSetupQuizId(q.recordId)}
                onAssign={() => setAssignmentQuizId(q.recordId)}
              />
            ))}
          </div>
        )}
      </div>

      {createOpen && (
        <CreateQuizModal
          initialMode={createSeedMode}
          onClose={() => setCreateOpen(false)}
          onCreated={(quizId) => {
            setCreateOpen(false)
            navigate(`/quizzes/${quizId}/edit`)
          }}
        />
      )}

      <ConfirmModal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && handleDelete(confirmDelete)}
        title="Delete this quiz?"
        description="This permanently removes the quiz and all its questions."
        confirmText="Delete"
        variant="destructive"
        loading={busyId === confirmDelete}
      />

      {hostSetupQuizId && (
        <HostSetupModal
          quizTitle={myQuizzes.find((q) => q.recordId === hostSetupQuizId)?.data.title ?? ''}
          busy={busyId === hostSetupQuizId}
          onClose={() => setHostSetupQuizId(null)}
          onConfirm={(settings) => startGameWithSettings(hostSetupQuizId, settings)}
        />
      )}

      {assignmentQuizId && (
        <AssignmentModal
          quizTitle={myQuizzes.find((q) => q.recordId === assignmentQuizId)?.data.title ?? ''}
          busy={busyId === assignmentQuizId}
          onClose={() => setAssignmentQuizId(null)}
          onCreate={async (deadlineAt, settings) => {
            const id = await createAssignment(assignmentQuizId, deadlineAt, settings)
            return id
          }}
          onDone={() => setAssignmentQuizId(null)}
        />
      )}
    </div>
  )
}

/* ───────────────── Empty state — three big tiles ───────────────── */

function EmptyAuthor({ onSeed }: { onSeed: (mode: CreateMode) => void }) {
  return (
    <div className="relative">
      <div className="mb-12 max-w-2xl">
        <h2
          className="font-display font-semibold tracking-tight"
          style={{ fontSize: 'clamp(1.85rem, 4vw, 2.75rem)', letterSpacing: '-0.025em' }}
        >
          Author your first quiz.
        </h2>
        <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
          Start blank, hand a topic to the AI, or point it at a URL. You can
          edit anything it produces before saving — nothing ships without you.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <SeedTile
          label="Blank"
          hint="Start with an empty canvas."
          onClick={() => onSeed('blank')}
          accent="var(--pq-shape-red)"
          diagram={
            <svg viewBox="0 0 80 80" className="h-full w-full" aria-hidden>
              <rect x="14" y="10" width="52" height="60" rx="5" fill="none" stroke="currentColor" strokeWidth="2" />
              <line x1="40" y1="30" x2="40" y2="52" stroke="currentColor" strokeWidth="2" />
              <line x1="29" y1="41" x2="51" y2="41" stroke="currentColor" strokeWidth="2" />
            </svg>
          }
        />
        <SeedTile
          label="From topic"
          hint="The AI drafts questions from a subject line."
          onClick={() => onSeed('topic')}
          accent="var(--pq-shape-blue)"
          diagram={
            <svg viewBox="0 0 80 80" className="h-full w-full" aria-hidden>
              <line x1="14" y1="20" x2="66" y2="20" stroke="currentColor" strokeWidth="2" />
              <line x1="14" y1="34" x2="50" y2="34" stroke="currentColor" strokeWidth="2" opacity="0.5" />
              <line x1="14" y1="48" x2="60" y2="48" stroke="currentColor" strokeWidth="2" opacity="0.5" />
              <line x1="14" y1="62" x2="40" y2="62" stroke="currentColor" strokeWidth="2" opacity="0.5" />
              <polygon points="58,52 70,52 64,64" fill="var(--pq-shape-blue)" />
            </svg>
          }
        />
        <SeedTile
          label="From URL"
          hint="Paste a Wikipedia or docs link — we read it for you."
          onClick={() => onSeed('url')}
          accent="var(--pq-shape-green)"
          diagram={
            <svg viewBox="0 0 80 80" className="h-full w-full" aria-hidden>
              <rect x="10" y="22" width="32" height="20" rx="10" fill="none" stroke="currentColor" strokeWidth="2" />
              <rect x="38" y="38" width="32" height="20" rx="10" fill="none" stroke="currentColor" strokeWidth="2" />
              <line x1="34" y1="32" x2="46" y2="48" stroke="currentColor" strokeWidth="2" />
            </svg>
          }
        />
      </div>
    </div>
  )
}

function SeedTile({
  label,
  hint,
  onClick,
  accent,
  diagram,
}: {
  label: string
  hint: string
  onClick: () => void
  accent: string
  diagram: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className="group relative flex flex-col items-start gap-5 overflow-hidden rounded-2xl border border-border bg-card p-7 text-left transition-all duration-300 hover:-translate-y-0.5 hover:border-foreground hover:shadow-card-hover"
    >
      <span
        aria-hidden
        className="absolute right-6 top-6 h-2.5 w-2.5 rounded-full transition-transform duration-300 group-hover:scale-125"
        style={{ backgroundColor: accent }}
      />
      <div className="h-20 w-20 text-foreground/55 transition-colors group-hover:text-foreground">
        {diagram}
      </div>
      <div>
        <h3 className="font-display text-[1.5rem] font-semibold leading-tight tracking-tight text-foreground">
          {label}
        </h3>
        <p className="mt-1 text-[13.5px] leading-relaxed text-muted-foreground">
          {hint}
        </p>
      </div>
      <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-foreground">
        Begin
        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
      </span>
    </button>
  )
}

/* ───────────────── New tile (in grid) ───────────────── */

function NewQuizTile({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group relative flex min-h-[220px] flex-col items-start justify-between overflow-hidden rounded-2xl bg-primary p-6 text-left text-primary-foreground transition-transform hover:-translate-y-0.5"
    >
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-foreground text-background transition-transform group-hover:rotate-90">
        <Plus className="h-5 w-5" aria-hidden />
      </span>
      <div>
        <h3 className="font-display text-[1.5rem] font-semibold leading-[1.05] tracking-tight">
          New quiz
        </h3>
        <p className="mt-1 text-[13.5px] opacity-80">
          Blank, from a topic, or from a URL.
        </p>
      </div>
    </button>
  )
}

/* ───────────────── Quiz card ───────────────── */

interface QuizCardProps {
  quizId: string
  quiz: Quiz
  questionCount: number
  busy: boolean
  onEdit: () => void
  onDuplicate: () => void
  onDelete: () => void
  onHost: () => void
  onAssign: () => void
}

function QuizCard({ quiz, questionCount, busy, onEdit, onDuplicate, onDelete, onHost, onAssign }: QuizCardProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const onDoc = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [menuOpen])

  const themeBadge = quiz.theme || 'general'
  const noQuestions = questionCount === 0

  return (
    <article className="group relative flex min-h-[220px] flex-col justify-between overflow-hidden rounded-2xl border border-border bg-card p-6 transition-all duration-300 hover:-translate-y-0.5 hover:border-foreground/30 hover:shadow-card-hover">
      <div>
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-display line-clamp-2 text-[1.4rem] font-semibold leading-[1.1] tracking-tight">
            {quiz.title || 'Untitled quiz'}
          </h3>
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((o) => !o)}
              aria-label="More actions"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              className="-m-1.5 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <MoreHorizontal className="h-4 w-4" aria-hidden />
            </button>
            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-[calc(100%+4px)] z-10 w-44 overflow-hidden rounded-xl border border-border bg-card shadow-card-hover"
              >
                <MenuItem onClick={() => { setMenuOpen(false); onEdit() }} icon={<Pencil className="h-3.5 w-3.5" />}>
                  Edit
                </MenuItem>
                <MenuItem onClick={() => { setMenuOpen(false); onDuplicate() }} icon={<Copy className="h-3.5 w-3.5" />}>
                  Duplicate
                </MenuItem>
                <MenuItem
                  onClick={() => { setMenuOpen(false); onAssign() }}
                  icon={<Send className="h-3.5 w-3.5" />}
                  disabled={questionCount === 0}
                >
                  Create assignment
                </MenuItem>
                <div className="border-t border-border" />
                <MenuItem
                  onClick={() => { setMenuOpen(false); onDelete() }}
                  icon={<Trash2 className="h-3.5 w-3.5" />}
                  danger
                >
                  Delete
                </MenuItem>
              </div>
            )}
          </div>
        </div>

        <p className="mt-2 line-clamp-2 min-h-[2.5em] text-[14px] leading-relaxed text-muted-foreground">
          {quiz.description || 'No description yet.'}
        </p>
      </div>

      <div className="mt-5 flex items-end justify-between gap-3">
        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] tabular text-muted-foreground">
          <span className="font-medium text-foreground">{questionCount}</span>
          <span>{questionCount === 1 ? 'question' : 'questions'}</span>
          <span className="h-3 w-px bg-border" />
          <span className="rounded-full border border-border bg-background px-2 py-0.5 text-[11px] capitalize">
            {themeBadge}
          </span>
        </div>

        <button
          onClick={onHost}
          disabled={busy || noQuestions}
          className="inline-flex shrink-0 items-center gap-1 rounded-full bg-foreground px-4 py-2 text-[13px] font-semibold text-background transition-all duration-200 hover:bg-primary hover:text-primary-foreground disabled:opacity-40 disabled:hover:bg-foreground disabled:hover:text-background"
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <>
              Host live
              <ArrowRight className="h-3.5 w-3.5" />
            </>
          )}
        </button>
      </div>

      {noQuestions && (
        <span className="absolute left-6 top-6 -translate-y-9 rounded-full border border-border bg-background px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Draft
        </span>
      )}
    </article>
  )
}

function MenuItem({
  onClick,
  icon,
  children,
  danger,
  disabled,
}: {
  onClick: () => void
  icon?: React.ReactNode
  children: React.ReactNode
  danger?: boolean
  disabled?: boolean
}) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      className={
        'flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] transition-colors disabled:opacity-40 disabled:cursor-not-allowed ' +
        (danger
          ? 'text-destructive hover:bg-destructive/10'
          : 'text-foreground hover:bg-secondary disabled:hover:bg-transparent')
      }
    >
      {icon}
      {children}
    </button>
  )
}

/* ───────────────── Create modal — restyled, same wiring ───────────────── */

interface CreateQuizModalProps {
  initialMode: CreateMode
  onClose: () => void
  onCreated: (quizId: string) => void
}

function CreateQuizModal({ initialMode, onClose, onCreated }: CreateQuizModalProps) {
  const [mode, setMode] = useState<CreateMode>(initialMode)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [aiInput, setAiInput] = useState('')
  const [count, setCount] = useState(8)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    setError(null)
    setBusy(true)
    try {
      if (mode === 'blank') {
        const t = title.trim()
        if (!t) throw new Error('Title required')
        const res = await callAction<{ recordId: string }>('createQuiz', {
          title: t,
          description,
        })
        if (!res.success || !res.data) throw new Error(res.error ?? 'Failed')
        onCreated(res.data.recordId)
        return
      }

      const input = aiInput.trim()
      if (!input) throw new Error(mode === 'topic' ? 'Topic required' : 'URL required')

      const token = await getAuthToken().catch(() => null)
      const aiRes = await fetch('/api/ai/generate-quiz', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ mode, input, count }),
      })
      const aiBody = (await aiRes.json().catch(() => ({}))) as {
        success?: boolean
        error?: string
        data?: { title: string; description?: string; questions: DraftAiQuestion[] }
      }
      if (!aiRes.ok || !aiBody.success || !aiBody.data) {
        throw new Error(aiBody.error ?? `AI generation failed (${aiRes.status})`)
      }

      const draft = aiBody.data
      const created = await callAction<{ recordId: string }>('createQuiz', {
        title: draft.title,
        description: draft.description ?? '',
      })
      if (!created.success || !created.data) {
        throw new Error(created.error ?? 'Failed to create quiz')
      }
      const quizId = created.data.recordId

      for (let i = 0; i < draft.questions.length; i++) {
        const q = draft.questions[i]
        const data = aiQuestionToData(q)
        await callAction('createQuestion', {
          quizId,
          order: i,
          type: q.type,
          text: q.text,
          data: JSON.stringify(data),
          timeLimit: q.timeLimit ?? 20,
          pointsMode: 'standard',
          mediaType: 'none',
          mediaUrl: '',
        })
      }
      onCreated(quizId)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open onClose={onClose} size="md">
      <div className="relative">
        <div className="px-6 pt-7 pb-3">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            New quiz
          </p>
          <h2 className="font-display text-[1.75rem] font-semibold leading-tight tracking-tight">
            How do you want to start?
          </h2>
        </div>

        <div className="px-6">
          {/* Big mode tabs */}
          <div className="grid grid-cols-3 gap-2 border-b border-border pb-4">
            <ModeTab
              active={mode === 'blank'}
              onClick={() => setMode('blank')}
              label="Blank"
              hint="From scratch"
            />
            <ModeTab
              active={mode === 'topic'}
              onClick={() => setMode('topic')}
              label="From topic"
              hint="AI drafts it"
            />
            <ModeTab
              active={mode === 'url'}
              onClick={() => setMode('url')}
              label="From URL"
              hint="Paste a link"
            />
          </div>

          <div className="space-y-4 py-5">
            {mode === 'blank' && (
              <>
                <Field label="Title">
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="World capitals"
                    autoFocus
                  />
                </Field>
                <Field label="Description" optional>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="One line of context for hosts and players."
                    rows={2}
                  />
                </Field>
              </>
            )}

            {(mode === 'topic' || mode === 'url') && (
              <>
                <Field label={mode === 'topic' ? 'Topic' : 'URL'}>
                  <Input
                    value={aiInput}
                    onChange={(e) => setAiInput(e.target.value)}
                    placeholder={
                      mode === 'topic'
                        ? 'e.g. The water cycle, for grade 5'
                        : 'https://en.wikipedia.org/wiki/Photosynthesis'
                    }
                    autoFocus
                  />
                </Field>
                <div>
                  <div className="mb-2 flex items-baseline justify-between">
                    <label className="text-[13px] font-medium text-foreground">
                      Number of questions
                    </label>
                    <span className="font-display tabular text-[1.5rem] font-semibold tracking-tight text-foreground">
                      {count}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={3}
                    max={20}
                    value={count}
                    onChange={(e) => setCount(Number(e.target.value))}
                    className="w-full accent-foreground"
                  />
                  <div className="mt-1 flex justify-between text-[10px] tabular text-muted-foreground">
                    <span>3</span>
                    <span>20</span>
                  </div>
                </div>
                <p className="rounded-lg border border-border bg-secondary/40 px-3 py-2 text-[12px] text-muted-foreground">
                  The AI drafts a quiz; you can edit it before saving.
                </p>
              </>
            )}

            {error && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border bg-secondary/30 px-6 py-4">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} loading={busy}>
            {mode === 'blank' ? 'Create' : 'Generate'}
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function Field({
  label,
  optional,
  children,
}: {
  label: string
  optional?: boolean
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="mb-1.5 flex items-baseline gap-2 text-[13px] font-medium text-foreground">
        {label}
        {optional && (
          <span className="text-[11px] font-normal text-muted-foreground">
            optional
          </span>
        )}
      </label>
      {children}
    </div>
  )
}

function ModeTab({
  active,
  onClick,
  label,
  hint,
}: {
  active: boolean
  onClick: () => void
  label: string
  hint: string
}) {
  return (
    <button
      onClick={onClick}
      className={
        'group relative flex flex-col items-start gap-0.5 rounded-xl border px-3.5 py-3 text-left transition-all ' +
        (active
          ? 'border-foreground bg-foreground text-background'
          : 'border-border bg-card text-foreground hover:border-foreground/40')
      }
    >
      <span className="font-display text-[15px] font-semibold leading-tight tracking-tight">
        {label}
      </span>
      <span
        className={
          'text-[11.5px] ' +
          (active ? 'text-background/70' : 'text-muted-foreground')
        }
      >
        {hint}
      </span>
    </button>
  )
}

function aiQuestionToData(q: DraftAiQuestion): Record<string, unknown> {
  switch (q.type) {
    case 'mcq': {
      // Coerce every option into the exact shape the editor expects;
      // the AI occasionally returns options with missing `text` (or with
      // alt keys like `label`), which then crashed `.trim()` in the editor.
      const raw = Array.isArray(q.options) ? q.options : []
      const opts = raw.slice(0, 4).map((o) => ({
        text: typeof o?.text === 'string' ? o.text : '',
        correct: !!o?.correct,
      }))
      while (opts.length < 4) opts.push({ text: '', correct: false })
      if (!opts.some((o) => o.correct)) opts[0].correct = true
      return { options: opts }
    }
    case 'true_false':
      return { correctAnswer: q.correctAnswer === true }
    case 'type_answer':
      return { correctAnswer: String(q.correctAnswer ?? '') }
    default:
      return { options: [{ text: '', correct: true }, { text: '', correct: false }, { text: '', correct: false }, { text: '', correct: false }] }
  }
}

// Suppress unused-import warning from QUESTION_TYPE_LABELS — used by editor page.
void QUESTION_TYPE_LABELS
// Suppress unused-import warning from Sparkles / LinkIcon — kept for consumers below if needed
void Sparkles
void LinkIcon

/* ───────────────── Per-game settings (shared by Host + Assignment) ─────────────────
 * Spec §4.4 — every game can be configured before launch.
 * Defaults match the classic experience: standard scoring, streak on,
 * nickname generator on (so phones are PvP-fast), classic (non-team) mode.
 */

interface GameSettings {
  scoringMode: 'standard' | 'accuracy'
  streakBonusEnabled: boolean
  nicknameGeneratorEnabled: boolean
  teamMode: boolean
}

const DEFAULT_SETTINGS: GameSettings = {
  scoringMode: 'standard',
  streakBonusEnabled: true,
  nicknameGeneratorEnabled: true,
  teamMode: false,
}

function GameSettingsForm({
  value,
  onChange,
}: {
  value: GameSettings
  onChange: (next: GameSettings) => void
}) {
  return (
    <div className="space-y-4">
      <Field label="Mode">
        <div className="grid grid-cols-2 gap-2">
          <ToggleTile
            active={!value.teamMode}
            onClick={() => onChange({ ...value, teamMode: false })}
            label="Classic"
            hint="Each player on their own"
          />
          <ToggleTile
            active={value.teamMode}
            onClick={() => onChange({ ...value, teamMode: true })}
            label="Team-personal"
            hint="Players on personal devices, scored as a team"
          />
        </div>
      </Field>
      <Field label="Scoring">
        <div className="grid grid-cols-2 gap-2">
          <ToggleTile
            active={value.scoringMode === 'standard'}
            onClick={() => onChange({ ...value, scoringMode: 'standard' })}
            label="Standard"
            hint="Speed-weighted, max 1000"
          />
          <ToggleTile
            active={value.scoringMode === 'accuracy'}
            onClick={() => onChange({ ...value, scoringMode: 'accuracy' })}
            label="Accuracy"
            hint="Flat 1000 per correct"
          />
        </div>
      </Field>
      <SwitchRow
        label="Streak bonus"
        hint="Reward consecutive correct answers"
        checked={value.streakBonusEnabled}
        onChange={(v) => onChange({ ...value, streakBonusEnabled: v })}
      />
      <SwitchRow
        label="Nickname generator"
        hint="Players spin a random name instead of typing"
        checked={value.nicknameGeneratorEnabled}
        onChange={(v) => onChange({ ...value, nicknameGeneratorEnabled: v })}
      />
    </div>
  )
}

function ToggleTile({
  active,
  onClick,
  label,
  hint,
}: {
  active: boolean
  onClick: () => void
  label: string
  hint: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'flex flex-col items-start gap-0.5 rounded-xl border px-3.5 py-3 text-left transition-all ' +
        (active
          ? 'border-foreground bg-foreground text-background'
          : 'border-border bg-card text-foreground hover:border-foreground/40')
      }
    >
      <span className="font-display text-[14px] font-semibold leading-tight tracking-tight">
        {label}
      </span>
      <span
        className={
          'text-[11px] leading-snug ' +
          (active ? 'text-background/70' : 'text-muted-foreground')
        }
      >
        {hint}
      </span>
    </button>
  )
}

function SwitchRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string
  hint: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-border bg-card px-3.5 py-3">
      <div>
        <div className="text-[13.5px] font-medium text-foreground">{label}</div>
        <div className="text-[11.5px] text-muted-foreground">{hint}</div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  )
}

/* ───────────────── Host setup modal ───────────────── */

function HostSetupModal({
  quizTitle,
  busy,
  onClose,
  onConfirm,
}: {
  quizTitle: string
  busy: boolean
  onClose: () => void
  onConfirm: (settings: GameSettings) => void
}) {
  const [settings, setSettings] = useState<GameSettings>(DEFAULT_SETTINGS)
  return (
    <Modal open onClose={busy ? () => {} : onClose} size="md">
      <div className="relative">
        <div className="px-6 pt-7 pb-3">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Host live · {quizTitle || 'Untitled'}
          </p>
          <h2 className="font-display text-[1.75rem] font-semibold leading-tight tracking-tight">
            Tune the game.
          </h2>
          <p className="mt-1 text-[13.5px] text-muted-foreground">
            You can change these any time before pressing Start in the lobby.
          </p>
        </div>

        <div className="px-6 pb-2">
          <GameSettingsForm value={settings} onChange={setSettings} />
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border bg-secondary/30 px-6 py-4 mt-4">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => onConfirm(settings)} loading={busy}>
            Open lobby
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </Modal>
  )
}

/* ───────────────── Assignment creation modal ───────────────── */

function AssignmentModal({
  quizTitle,
  busy,
  onClose,
  onCreate,
  onDone,
}: {
  quizTitle: string
  busy: boolean
  onClose: () => void
  onCreate: (deadlineAt: number, settings: GameSettings) => Promise<string | null>
  onDone: () => void
}) {
  // Default: 7 days from now, formatted for the datetime-local input.
  const defaultDeadline = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() + 7)
    d.setMinutes(0, 0, 0)
    // datetime-local expects "YYYY-MM-DDTHH:mm" in local time.
    const pad = (n: number) => n.toString().padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }, [])
  const [deadline, setDeadline] = useState(defaultDeadline)
  const [settings, setSettings] = useState<GameSettings>(DEFAULT_SETTINGS)
  const [created, setCreated] = useState<{ gameId: string; pin: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const { error: toastError } = useToast()

  // Once created, look up the new game's PIN via a record query — but the
  // returned data only includes recordId. We need the PIN, so re-call the
  // server to get it… actually `createGame` action stores the PIN inside
  // the record. Easier: keep just the recordId, and the share URL by
  // querying the local cache once the game record streams in.
  const gamesQ = useQuery<{ pin: string; mode: string }>('games', created ? { where: { recordId: created.gameId } } : undefined)
  const gameRow = gamesQ.records?.find((r) => r.recordId === created?.gameId)
  const livePin = gameRow?.data.pin ?? created?.pin ?? ''

  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const shareUrl = livePin ? `${origin}/play/${livePin}` : ''

  async function handleCreate() {
    const deadlineMs = new Date(deadline).getTime()
    if (!deadlineMs || isNaN(deadlineMs)) {
      toastError('Pick a valid deadline')
      return
    }
    if (deadlineMs <= Date.now()) {
      toastError('Deadline must be in the future')
      return
    }
    const id = await onCreate(deadlineMs, settings)
    if (id) {
      setCreated({ gameId: id, pin: '' })
    }
  }

  async function copyLink() {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      // ignore
    }
  }

  return (
    <Modal open onClose={busy ? () => {} : (created ? onDone : onClose)} size="md">
      <div className="relative">
        {!created ? (
          <>
            <div className="px-6 pt-7 pb-3">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Async assignment · {quizTitle || 'Untitled'}
              </p>
              <h2 className="font-display text-[1.75rem] font-semibold leading-tight tracking-tight">
                Set a deadline & share a link.
              </h2>
              <p className="mt-1 text-[13.5px] text-muted-foreground">
                Players join from any device, enter a nickname, and play through
                at their own pace before the deadline.
              </p>
            </div>

            <div className="px-6 pb-2 space-y-4">
              <Field label="Deadline">
                <div className="relative">
                  <CalendarClock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="datetime-local"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    className="h-11 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm tabular shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>
              </Field>
              <GameSettingsForm value={settings} onChange={setSettings} />
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-border bg-secondary/30 px-6 py-4 mt-4">
              <Button variant="ghost" onClick={onClose} disabled={busy}>
                Cancel
              </Button>
              <Button onClick={handleCreate} loading={busy}>
                Create assignment
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="px-6 pt-7 pb-3">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Share with your class
              </p>
              <h2 className="font-display text-[1.75rem] font-semibold leading-tight tracking-tight">
                Assignment is live.
              </h2>
              <p className="mt-1 text-[13.5px] text-muted-foreground">
                Anyone with this link can join. Results land in Reports as
                players finish.
              </p>
            </div>

            <div className="px-6 pb-4 space-y-3">
              <Field label="Share link">
                <div className="flex gap-2">
                  <Input value={shareUrl} readOnly className="font-mono text-[12.5px]" />
                  <Button onClick={copyLink} variant="outline" disabled={!shareUrl}>
                    {copied ? <CheckIcon className="h-3.5 w-3.5" /> : 'Copy'}
                  </Button>
                </div>
              </Field>
              {livePin && (
                <p className="text-[12.5px] text-muted-foreground tabular">
                  PIN: <span className="font-display text-foreground font-semibold tracking-[0.1em]">{livePin}</span>
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-border bg-secondary/30 px-6 py-4 mt-2">
              <Button onClick={onDone}>Done</Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
