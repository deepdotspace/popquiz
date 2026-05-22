import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from 'deepspace'
import {
  ArrowLeft,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Loader2,
  AlertCircle,
  ListChecks,
  BarChart3,
  ToggleLeft,
  Keyboard,
  SlidersHorizontal,
  Play,
  Check,
  Cloud,
} from 'lucide-react'
import { Input, Button, useToast } from '../../../../components/ui'
import { callAction } from '../../../../lib/actions-client'
import type { Quiz, Question } from '../../../../lib/types'
import {
  QUESTION_TYPES,
  QUESTION_TYPE_LABELS,
  TIME_LIMIT_OPTIONS,
  type QuestionType,
  type MediaType,
  type QuestionData,
  type McqData,
} from '../../../../lib/quiz-types'
import { MediaEditor } from '../../../../components/quiz-editor/MediaEditor'
import {
  McqEditor,
  PollEditor,
  TrueFalseEditor,
  TypeAnswerEditor,
  SliderEditor,
} from '../../../../components/quiz-editor/QuestionTypeEditors'

/* ----------------------------------------------------------------------
 * Quiz editor shell. Calm, focused desk-mode layout: sticky top bar,
 * narrow question rail on the left, big notecard-style editor in the
 * center, inspector underneath. Auto-save is wired throughout; the top
 * bar reflects "Saved · 2s ago" state subtly.
 * -------------------------------------------------------------------- */

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

const TYPE_ICON: Record<QuestionType, React.ComponentType<{ className?: string }>> = {
  mcq: ListChecks,
  poll: BarChart3,
  true_false: ToggleLeft,
  type_answer: Keyboard,
  slider: SlidersHorizontal,
}

export default function QuizEditorPage() {
  const { id: quizId = '' } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { error: toastError } = useToast()

  const quizzesQ = useQuery<Quiz>('quizzes')
  const questionsQ = useQuery<Question>('questions', { where: { quizId } })

  const quiz = useMemo(
    () => (quizzesQ.records ?? []).find((r) => r.recordId === quizId),
    [quizzesQ.records, quizId],
  )

  const questions = useMemo(() => {
    return (questionsQ.records ?? []).slice().sort((a, b) => a.data.order - b.data.order)
  }, [questionsQ.records])

  const [selectedId, setSelectedId] = useState<string | null>(null)
  useEffect(() => {
    if (!selectedId && questions.length > 0) setSelectedId(questions[0].recordId)
    if (selectedId && !questions.some((q) => q.recordId === selectedId)) {
      setSelectedId(questions[0]?.recordId ?? null)
    }
  }, [questions, selectedId])

  const selected = questions.find((q) => q.recordId === selectedId)

  // Title editing — auto-save on blur. Cheap lifted state because the
  // top bar shows it inline.
  const [title, setTitle] = useState('')
  const [titleSave, setTitleSave] = useState<SaveState>('idle')
  const [titleSavedAt, setTitleSavedAt] = useState<number | null>(null)
  useEffect(() => {
    if (quiz) setTitle(quiz.data.title)
  }, [quiz?.recordId, quiz?.data.title])

  async function saveQuizTitle() {
    if (!quiz) return
    if (title === quiz.data.title) return
    setTitleSave('saving')
    const res = await callAction('updateQuiz', {
      quizId: quiz.recordId,
      patch: { title, description: quiz.data.description },
    })
    if (res.success) {
      setTitleSave('saved')
      setTitleSavedAt(Date.now())
    } else {
      setTitleSave('error')
    }
  }

  // Aggregate save state — child editor reports up via setQuestionSave.
  const [questionSave, setQuestionSave] = useState<SaveState>('idle')
  const [questionSavedAt, setQuestionSavedAt] = useState<number | null>(null)
  const aggregateSave = pickSaveState(titleSave, questionSave)
  const aggregateSavedAt = Math.max(titleSavedAt ?? 0, questionSavedAt ?? 0) || null

  async function handleAddQuestion() {
    const order = questions.length
    const defaultData: McqData = {
      options: [
        { text: '', correct: true },
        { text: '', correct: false },
        { text: '', correct: false },
        { text: '', correct: false },
      ],
    }
    const res = await callAction<{ recordId: string }>('createQuestion', {
      quizId,
      order,
      type: 'mcq',
      text: '',
      data: JSON.stringify(defaultData),
      timeLimit: 20,
      pointsMode: 'standard',
      mediaType: 'none',
      mediaUrl: '',
    })
    if (res.success && res.data) setSelectedId(res.data.recordId)
    else toastError("Couldn't add question", res.error ?? 'Try again.')
  }

  async function handleDeleteQuestion(questionId: string) {
    const res = await callAction('deleteQuestion', { questionId })
    if (!res.success) toastError("Couldn't delete", res.error ?? 'Try again.')
  }

  async function handleMove(questionId: string, dir: -1 | 1) {
    const idx = questions.findIndex((q) => q.recordId === questionId)
    const target = idx + dir
    if (idx < 0 || target < 0 || target >= questions.length) return
    const next = questions.slice()
    const [moved] = next.splice(idx, 1)
    next.splice(target, 0, moved)
    await callAction('reorderQuestions', {
      quizId,
      orderedIds: next.map((q) => q.recordId),
    })
  }

  if (!quizzesQ.records) {
    return (
      <div className="flex min-h-full items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    )
  }
  if (!quiz) {
    return (
      <div className="mx-auto max-w-md px-6 py-20 text-center">
        <h2 className="font-display text-2xl font-semibold">Quiz not found</h2>
        <p className="mt-1 text-sm text-muted-foreground">It may have been deleted.</p>
        <Button onClick={() => navigate('/quizzes')} className="mt-6">
          Back to my kahoots
        </Button>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col bg-background text-foreground">
      {/* ── Sticky top bar ──────────────────────────────────────── */}
      <header className="sticky top-0 z-20 flex items-center gap-4 border-b border-border bg-background/85 px-5 py-3 backdrop-blur-md">
        <button
          onClick={() => navigate('/quizzes')}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">My kahoots</span>
        </button>

        <div className="h-5 w-px bg-border" />

        {/* Inline-editable title */}
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={saveQuizTitle}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
            }}
            placeholder="Untitled quiz"
            className="font-display min-w-0 flex-1 truncate bg-transparent text-xl font-semibold tracking-tight text-foreground outline-none placeholder:text-muted-foreground/60 sm:text-2xl"
          />
          <span className="hidden whitespace-nowrap text-xs text-muted-foreground tabular sm:inline">
            {questions.length} {questions.length === 1 ? 'question' : 'questions'}
          </span>
        </div>

        <SaveIndicator state={aggregateSave} savedAt={aggregateSavedAt} />

        <Button
          size="sm"
          disabled={questions.length === 0}
          onClick={() => navigate(`/quizzes?host=${quizId}`)}
          className="font-display gap-1.5"
        >
          <Play className="h-3.5 w-3.5" />
          Host live
          <span aria-hidden>→</span>
        </Button>
      </header>

      {/* ── Body: rail + main pane ──────────────────────────────── */}
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[260px_1fr]">
        <aside className="hidden min-h-0 flex-col border-r border-border bg-card/40 lg:flex">
          <div className="flex items-center justify-between px-5 pb-2 pt-5">
            <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Questions
            </span>
            <span className="text-xs text-muted-foreground tabular">
              {questions.length}
            </span>
          </div>

          <div className="flex-1 space-y-px overflow-y-auto px-2 pb-3">
            {questions.map((q, idx) => (
              <QuestionListItem
                key={q.recordId}
                index={idx}
                question={q.data}
                selected={q.recordId === selectedId}
                canMoveUp={idx > 0}
                canMoveDown={idx < questions.length - 1}
                onSelect={() => setSelectedId(q.recordId)}
                onMoveUp={() => handleMove(q.recordId, -1)}
                onMoveDown={() => handleMove(q.recordId, 1)}
                onDelete={() => handleDeleteQuestion(q.recordId)}
              />
            ))}

            {/* Dashed-tile add affordance — not a button */}
            <button
              type="button"
              onClick={handleAddQuestion}
              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-border bg-transparent px-3 py-3 text-xs font-medium text-muted-foreground transition-all hover:border-foreground/40 hover:bg-secondary/40 hover:text-foreground"
            >
              <Plus className="h-3.5 w-3.5" />
              Add question
            </button>
          </div>
        </aside>

        <main className="min-h-0 overflow-y-auto">
          {selected ? (
            <QuestionEditor
              key={selected.recordId}
              questionId={selected.recordId}
              question={selected.data}
              index={questions.findIndex((q) => q.recordId === selected.recordId)}
              total={questions.length}
              onSaveStateChange={(s) => {
                setQuestionSave(s)
                if (s === 'saved') setQuestionSavedAt(Date.now())
              }}
            />
          ) : (
            <EmptyEditor onAdd={handleAddQuestion} />
          )}
        </main>
      </div>
    </div>
  )
}

/* ----------------------------------------------------------------------
 * Save indicator — subtle text-only state. "Saved · 2s ago" pattern.
 * -------------------------------------------------------------------- */

function SaveIndicator({ state, savedAt }: { state: SaveState; savedAt: number | null }) {
  const [, force] = useState(0)
  // Keep the "ago" text fresh.
  useEffect(() => {
    if (state !== 'saved' || !savedAt) return
    const t = setInterval(() => force((n) => n + 1), 5_000)
    return () => clearInterval(t)
  }, [state, savedAt])

  if (state === 'saving') {
    return (
      <span className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:inline-flex">
        <Loader2 className="h-3 w-3 animate-spin" />
        Saving…
      </span>
    )
  }
  if (state === 'error') {
    return (
      <span className="hidden items-center gap-1.5 text-xs text-destructive sm:inline-flex">
        <AlertCircle className="h-3 w-3" />
        Save failed
      </span>
    )
  }
  if (state === 'saved' && savedAt) {
    return (
      <span className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:inline-flex">
        <Cloud className="h-3 w-3" />
        Saved · {formatAgo(savedAt)}
      </span>
    )
  }
  return null
}

function formatAgo(ts: number): string {
  const diff = Math.max(0, Math.floor((Date.now() - ts) / 1000))
  if (diff < 5) return 'just now'
  if (diff < 60) return `${diff}s ago`
  const m = Math.floor(diff / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  return `${h}h ago`
}

function pickSaveState(a: SaveState, b: SaveState): SaveState {
  if (a === 'error' || b === 'error') return 'error'
  if (a === 'saving' || b === 'saving') return 'saving'
  if (a === 'saved' || b === 'saved') return 'saved'
  return 'idle'
}

/* ----------------------------------------------------------------------
 * Left-rail question list item. The selected row uses bold + indent +
 * a leading tabular index treated like a notecard tab — NOT a side
 * stripe (banned by the design system).
 * -------------------------------------------------------------------- */

interface QuestionListItemProps {
  index: number
  question: Question
  selected: boolean
  canMoveUp: boolean
  canMoveDown: boolean
  onSelect: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onDelete: () => void
}

function QuestionListItem({
  index,
  question,
  selected,
  canMoveUp,
  canMoveDown,
  onSelect,
  onMoveUp,
  onMoveDown,
  onDelete,
}: QuestionListItemProps) {
  const Icon = TYPE_ICON[question.type as QuestionType] ?? ListChecks
  const issue = computeIssue(question)
  return (
    <div
      onClick={onSelect}
      className={
        'group relative flex cursor-pointer items-start gap-2.5 rounded-md py-2 pr-1 transition-all ' +
        (selected
          ? 'bg-secondary/70 pl-4 text-foreground'
          : 'pl-3 text-foreground/85 hover:bg-secondary/40 hover:pl-3.5')
      }
    >
      <span
        className={
          'mt-0.5 inline-block w-7 shrink-0 font-display text-[11px] tabular ' +
          (selected ? 'font-semibold text-foreground' : 'text-muted-foreground')
        }
      >
        Q{String(index + 1).padStart(2, '0')}
      </span>
      <Icon
        className={
          'mt-[3px] h-3.5 w-3.5 shrink-0 ' +
          (selected ? 'text-foreground' : 'text-muted-foreground')
        }
      />
      <div className="min-w-0 flex-1">
        <div
          className={
            'truncate text-[13px] leading-snug ' +
            (selected ? 'font-semibold' : 'font-normal')
          }
        >
          {question.text || (
            <span className="italic text-muted-foreground">Untitled question</span>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-[10.5px] uppercase tracking-wider text-muted-foreground">
          <span>{question.timeLimit}s</span>
          {issue && (
            <>
              <span aria-hidden>·</span>
              <span className="inline-flex items-center gap-1 text-warning normal-case tracking-normal">
                <AlertCircle className="h-2.5 w-2.5" />
                needs attention
              </span>
            </>
          )}
        </div>
      </div>
      <div className="flex flex-col opacity-0 transition-opacity group-hover:opacity-100">
        <button
          onClick={(e) => {
            e.stopPropagation()
            onMoveUp()
          }}
          disabled={!canMoveUp}
          className="rounded p-0.5 text-muted-foreground hover:bg-card hover:text-foreground disabled:opacity-30"
          aria-label="Move up"
        >
          <ChevronUp className="h-3 w-3" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onMoveDown()
          }}
          disabled={!canMoveDown}
          className="rounded p-0.5 text-muted-foreground hover:bg-card hover:text-foreground disabled:opacity-30"
          aria-label="Move down"
        >
          <ChevronDown className="h-3 w-3" />
        </button>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation()
          onDelete()
        }}
        className="mt-0.5 rounded p-1 text-muted-foreground/70 opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
        aria-label="Delete question"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  )
}

function computeIssue(q: Question): string | null {
  if (!(q.text ?? '').trim()) return 'Question has no text yet'
  if (q.type === 'mcq') {
    const data = parseData(q.data) as McqData | null
    if (!data?.options?.some((o) => o?.correct))
      return 'No correct answer marked'
    if (!data.options.some((o) => (o?.text ?? '').trim()))
      return 'Answer choices are empty'
  }
  return null
}

/* ----------------------------------------------------------------------
 * Empty state for when there are no questions yet.
 * -------------------------------------------------------------------- */

function EmptyEditor({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="font-display text-2xl text-foreground">A blank notecard.</div>
      <p className="max-w-xs text-sm text-muted-foreground">
        Add your first question. Players will see big shapes; you'll see the
        words behind them here.
      </p>
      <Button onClick={onAdd}>
        <Plus className="h-4 w-4" />
        Add your first question
      </Button>
    </div>
  )
}

/* ----------------------------------------------------------------------
 * Main editor — the "notecard" the host is filling in. Big question
 * input at the top, type-specific editor below, inspector at the foot.
 * -------------------------------------------------------------------- */

interface QuestionEditorProps {
  questionId: string
  question: Question
  index: number
  total: number
  onSaveStateChange: (s: SaveState) => void
}

function QuestionEditor({
  questionId,
  question,
  index,
  total,
  onSaveStateChange,
}: QuestionEditorProps) {
  const [text, setText] = useState<string>(question.text ?? '')
  const [type, setType] = useState<QuestionType>((question.type as QuestionType) ?? 'mcq')
  const [data, setData] = useState<QuestionData>(parseData(question.data) ?? defaultDataFor(type))
  const [timeLimit, setTimeLimit] = useState<number>(question.timeLimit || 20)
  const [pointsMode, setPointsMode] = useState<string>(question.pointsMode || 'standard')
  const [mediaType, setMediaType] = useState<MediaType>((question.mediaType as MediaType) ?? 'none')
  const [mediaUrl, setMediaUrl] = useState<string>(question.mediaUrl || '')

  // Reset local mirror when the selected question changes.
  useEffect(() => {
    setText(question.text ?? '')
    setType((question.type as QuestionType) ?? 'mcq')
    setData(parseData(question.data) ?? defaultDataFor((question.type as QuestionType) ?? 'mcq'))
    setTimeLimit(question.timeLimit || 20)
    setPointsMode(question.pointsMode || 'standard')
    setMediaType((question.mediaType as MediaType) ?? 'none')
    setMediaUrl(question.mediaUrl || '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionId])

  // Debounced auto-save.
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const firstRun = useRef(true)
  useEffect(() => {
    // Skip the initial mount-from-prop-sync to avoid a phantom save tick.
    if (firstRun.current) {
      firstRun.current = false
      return
    }
    if (saveTimer.current) clearTimeout(saveTimer.current)
    onSaveStateChange('saving')
    saveTimer.current = setTimeout(() => {
      void callAction('updateQuestion', {
        questionId,
        patch: {
          text,
          type,
          data: JSON.stringify(data),
          timeLimit,
          pointsMode,
          mediaType,
          mediaUrl,
        },
      }).then((res) => {
        onSaveStateChange(res.success ? 'saved' : 'error')
      })
    }, 500)
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionId, text, type, JSON.stringify(data), timeLimit, pointsMode, mediaType, mediaUrl])

  const issue = computeIssue({
    ...question,
    text,
    type,
    data: JSON.stringify(data),
  })

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-8 sm:px-10 sm:py-12">
      {/* Tiny breadcrumb / position marker */}
      <div className="mb-4 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        <span className="font-display tabular text-foreground">
          Q{String(index + 1).padStart(2, '0')}
        </span>
        <span aria-hidden>/</span>
        <span className="tabular">{String(total).padStart(2, '0')}</span>
        <span aria-hidden>·</span>
        <span>{QUESTION_TYPE_LABELS[type]}</span>
      </div>

      {/* The notecard */}
      <article className="rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
        {/* Big question text — the host's centerpiece */}
        <div className="border-b border-border px-6 pb-5 pt-7 sm:px-10 sm:pt-10">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="What's your question?"
            rows={2}
            className="font-display w-full resize-none bg-transparent text-3xl font-semibold leading-[1.15] tracking-tight text-foreground outline-none placeholder:text-muted-foreground/50 sm:text-4xl"
          />
        </div>

        {/* Type-specific editor */}
        <div className="px-6 py-6 sm:px-10">
          {type === 'mcq' && <McqEditor data={data as McqData} onChange={setData} />}
          {type === 'poll' && (
            <PollEditor data={data as Parameters<typeof PollEditor>[0]['data']} onChange={setData} />
          )}
          {type === 'true_false' && (
            <TrueFalseEditor data={data as Parameters<typeof TrueFalseEditor>[0]['data']} onChange={setData} />
          )}
          {type === 'type_answer' && (
            <TypeAnswerEditor data={data as Parameters<typeof TypeAnswerEditor>[0]['data']} onChange={setData} />
          )}
          {type === 'slider' && (
            <SliderEditor data={data as Parameters<typeof SliderEditor>[0]['data']} onChange={setData} />
          )}
        </div>
      </article>

      {/* Validation — single muted line, NOT a colored card */}
      {issue && (
        <div className="mt-3 flex items-center gap-2 px-1 text-xs text-muted-foreground">
          <AlertCircle className="h-3.5 w-3.5 text-warning" />
          <span>{issue}</span>
        </div>
      )}

      {/* Inspector */}
      <section className="mt-8 grid gap-x-6 gap-y-5 rounded-2xl border border-border bg-card/40 px-6 py-5 sm:grid-cols-3 sm:px-8">
        <InspectorField label="Time limit">
          <select
            value={timeLimit}
            onChange={(e) => setTimeLimit(Number(e.target.value))}
            className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm tabular shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {TIME_LIMIT_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s} seconds
              </option>
            ))}
          </select>
        </InspectorField>

        <InspectorField label="Points">
          <PointsToggle value={pointsMode} onChange={setPointsMode} />
        </InspectorField>

        <InspectorField label="Type">
          <select
            value={type}
            onChange={(e) => {
              const t = e.target.value as QuestionType
              setType(t)
              setData(defaultDataFor(t))
            }}
            className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {Object.values(QUESTION_TYPES).map((t) => (
              <option key={t} value={t}>
                {QUESTION_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </InspectorField>

        <div className="sm:col-span-3">
          <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Media
          </div>
          <MediaEditor
            mediaType={mediaType}
            mediaUrl={mediaUrl}
            onChange={(p) => {
              setMediaType(p.mediaType)
              setMediaUrl(p.mediaUrl)
            }}
          />
        </div>
      </section>
    </div>
  )
}

function InspectorField({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </div>
      {children}
    </div>
  )
}

function PointsToggle({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  const options: { v: string; label: string }[] = [
    { v: 'standard', label: 'Standard' },
    { v: 'none', label: 'No points' },
  ]
  return (
    <div className="inline-flex h-9 w-full items-center rounded-md border border-input bg-background p-0.5 text-xs">
      {options.map((o) => {
        const active = value === o.v
        return (
          <button
            key={o.v}
            type="button"
            onClick={() => onChange(o.v)}
            className={
              'inline-flex h-full flex-1 items-center justify-center gap-1 rounded-[5px] font-medium transition-colors ' +
              (active
                ? 'bg-foreground text-background'
                : 'text-muted-foreground hover:text-foreground')
            }
          >
            {active && <Check className="h-3 w-3" />}
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

// Note: 'Input' and 'Button' imports are kept (used by the empty/not-found states).
// Suppress unused-import linting in case of code removal during edits.
void Input

/* ----------------------------------------------------------------------
 * Helpers
 * -------------------------------------------------------------------- */

function parseData(s: string): QuestionData | null {
  try {
    return JSON.parse(s) as QuestionData
  } catch {
    return null
  }
}

function defaultDataFor(type: QuestionType): QuestionData {
  switch (type) {
    case 'mcq':
      return {
        options: [
          { text: '', correct: true },
          { text: '', correct: false },
          { text: '', correct: false },
          { text: '', correct: false },
        ],
      }
    case 'poll':
      return { options: [{ text: '' }, { text: '' }] }
    case 'true_false':
      return { correctAnswer: true }
    case 'type_answer':
      return { correctAnswer: '', alternates: [] }
    case 'slider':
      return { min: 0, max: 100, target: 50, tolerance: 0.05 }
  }
}
