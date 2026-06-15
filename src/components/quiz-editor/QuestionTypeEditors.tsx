import { Plus, X, Check } from 'lucide-react'
import { Input } from '../ui'
import {
  SHAPE_COLORS,
  type McqData,
  type PollData,
  type TrueFalseData,
  type TypeAnswerData,
  type SliderData,
} from '../../lib/quiz-types'

/* ----------------------------------------------------------------------
 * Shape glyphs — tiny SVGs of the four iconic answer shapes.
 * Rendered inline next to MCQ/poll inputs so the host knows which color
 * the player will see on their phone.
 * -------------------------------------------------------------------- */

function ShapeGlyph({ index, size = 14 }: { index: number; size?: number }) {
  const fill = SHAPE_COLORS[index].color
  const s = size
  switch (SHAPE_COLORS[index].name) {
    case 'triangle':
      return (
        <svg width={s} height={s} viewBox="0 0 16 16" aria-hidden>
          <polygon points="8,2 14,14 2,14" fill={fill} />
        </svg>
      )
    case 'diamond':
      return (
        <svg width={s} height={s} viewBox="0 0 16 16" aria-hidden>
          <polygon points="8,1.5 14.5,8 8,14.5 1.5,8" fill={fill} />
        </svg>
      )
    case 'circle':
      return (
        <svg width={s} height={s} viewBox="0 0 16 16" aria-hidden>
          <circle cx="8" cy="8" r="6.4" fill={fill} />
        </svg>
      )
    case 'square':
      return (
        <svg width={s} height={s} viewBox="0 0 16 16" aria-hidden>
          <rect x="2" y="2" width="12" height="12" fill={fill} />
        </svg>
      )
    default:
      return null
  }
}

/* ----------------------------------------------------------------------
 * MCQ — 2x2 grid. Each row has a 6px shape-color bar (separate flex
 * child, NOT border-left), a shape glyph, the option text input, and a
 * "correct" pill toggle on the right.
 * -------------------------------------------------------------------- */

export function McqEditor({
  data,
  onChange,
}: {
  data: McqData
  onChange: (d: McqData) => void
}) {
  const opts = ensureFour(data.options)

  const setOpt = (i: number, patch: Partial<{ text: string; correct: boolean }>) => {
    const next = opts.map((o, idx) => (idx === i ? { ...o, ...patch } : o))
    onChange({ ...data, options: next })
  }

  const toggleCorrect = (i: number, value: boolean) => {
    if (data.multiCorrect) {
      setOpt(i, { correct: value })
    } else {
      onChange({
        ...data,
        options: opts.map((opt, idx) => ({ ...opt, correct: idx === i ? value : false })),
      })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Answer choices
        </span>
        <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={!!data.multiCorrect}
            onChange={(e) => onChange({ ...data, multiCorrect: e.target.checked })}
            className="h-3.5 w-3.5 accent-primary"
          />
          Allow multiple correct
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {opts.map((o, i) => (
          <div
            key={i}
            className="group flex items-stretch overflow-hidden rounded-lg border border-border bg-card transition-shadow focus-within:shadow-[0_2px_0_var(--color-border)] hover:border-foreground/20"
          >
            {/* Shape-color bar — a separate flex child, NOT a border-left.
                This is the visual link to the player's answer button. */}
            <div
              aria-hidden
              style={{ width: '6px', backgroundColor: SHAPE_COLORS[i].color }}
            />
            <div className="flex flex-1 items-center gap-2.5 px-3 py-2.5">
              <ShapeGlyph index={i} />
              <Input
                value={o.text}
                onChange={(e) => setOpt(i, { text: e.target.value })}
                placeholder={`Answer ${i + 1}`}
                className="h-8 flex-1 border-0 bg-transparent px-0 text-sm shadow-none focus-visible:ring-0"
              />
              <CorrectToggle
                active={!!o.correct}
                onClick={() => toggleCorrect(i, !o.correct)}
              />
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Tap the circle on the right to mark an answer correct. Players will see this option as the{' '}
        <span style={{ color: SHAPE_COLORS[0].color }}>red triangle</span>,{' '}
        <span style={{ color: SHAPE_COLORS[1].color }}>blue diamond</span>,{' '}
        <span style={{ color: SHAPE_COLORS[2].color }}>yellow circle</span>, and{' '}
        <span style={{ color: SHAPE_COLORS[3].color }}>green square</span>.
      </p>
    </div>
  )
}

function CorrectToggle({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={active ? 'Marked correct' : 'Mark as correct'}
      className={
        'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-all ' +
        (active
          ? 'border-primary bg-primary text-primary-foreground shadow-[0_0_0_3px_var(--color-primary)/0.18]'
          : 'border-border bg-background text-transparent hover:border-foreground/40')
      }
    >
      <Check
        className="h-3.5 w-3.5"
        strokeWidth={3}
        style={active ? undefined : { color: 'transparent' }}
      />
    </button>
  )
}

function ensureFour(options: { text: string; correct: boolean }[] | undefined) {
  const out = (options ?? []).slice(0, 4)
  while (out.length < 4) out.push({ text: '', correct: false })
  return out
}

/* ----------------------------------------------------------------------
 * Poll — same row treatment as MCQ minus the correct toggle. Up to 6
 * choices.
 * -------------------------------------------------------------------- */

export function PollEditor({
  data,
  onChange,
}: {
  data: PollData
  onChange: (d: PollData) => void
}) {
  const opts = data.options ?? []
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Choices
        </span>
        <span className="text-xs text-muted-foreground tabular">
          {opts.length}/6
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {opts.map((o, i) => (
          <div
            key={i}
            className="group flex items-stretch overflow-hidden rounded-lg border border-border bg-card hover:border-foreground/20"
          >
            <div
              aria-hidden
              style={{ width: '6px', backgroundColor: SHAPE_COLORS[i % 4].color }}
            />
            <div className="flex flex-1 items-center gap-2.5 px-3 py-2.5">
              <ShapeGlyph index={i % 4} />
              <Input
                value={o.text}
                onChange={(e) => {
                  const next = opts.map((opt, idx) =>
                    idx === i ? { ...opt, text: e.target.value } : opt,
                  )
                  onChange({ ...data, options: next })
                }}
                placeholder={`Choice ${i + 1}`}
                className="h-8 flex-1 border-0 bg-transparent px-0 text-sm shadow-none focus-visible:ring-0"
              />
              <button
                type="button"
                onClick={() =>
                  onChange({ ...data, options: opts.filter((_, idx) => idx !== i) })
                }
                disabled={opts.length <= 2}
                className="rounded-full p-1 text-muted-foreground/60 opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive disabled:cursor-not-allowed group-hover:opacity-100"
                aria-label="Remove choice"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {opts.length < 6 && (
        <button
          type="button"
          onClick={() => onChange({ ...data, options: [...opts, { text: '' }] })}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground/70 underline-offset-4 transition-colors hover:text-foreground hover:underline"
        >
          <Plus className="h-3.5 w-3.5" />
          Add choice
        </button>
      )}
    </div>
  )
}

/* ----------------------------------------------------------------------
 * True / False — two giant pill buttons in the first two shape colors
 * (red and blue). Active = filled with shape color, dimmed when inactive.
 * -------------------------------------------------------------------- */

export function TrueFalseEditor({
  data,
  onChange,
}: {
  data: TrueFalseData
  onChange: (d: TrueFalseData) => void
}) {
  const options: { val: boolean; label: string; index: number }[] = [
    { val: true, label: 'True', index: 1 },   // diamond / blue
    { val: false, label: 'False', index: 0 }, // triangle / red
  ]
  return (
    <div className="space-y-3">
      <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        Correct answer
      </div>
      <div className="grid grid-cols-2 gap-3">
        {options.map(({ val, label, index }) => {
          const color = SHAPE_COLORS[index].color
          const active = data.correctAnswer === val
          return (
            <button
              key={label}
              type="button"
              onClick={() => onChange({ correctAnswer: val })}
              aria-pressed={active}
              className={
                'relative flex items-center justify-center gap-3 rounded-xl px-6 py-8 font-display text-2xl font-semibold tracking-tight transition-all ' +
                (active
                  ? 'text-white shadow-[var(--shadow-card-hover)]'
                  : 'border border-border bg-card text-foreground/40 hover:border-foreground/30 hover:text-foreground/70')
              }
              style={
                active
                  ? { backgroundColor: color }
                  : undefined
              }
            >
              <ShapeGlyph index={index} size={20} />
              {label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/* ----------------------------------------------------------------------
 * Type Answer — single primary input + reveal-on-demand alternates as
 * removable pills.
 * -------------------------------------------------------------------- */

export function TypeAnswerEditor({
  data,
  onChange,
}: {
  data: TypeAnswerData
  onChange: (d: TypeAnswerData) => void
}) {
  const alts = data.alternates ?? []
  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Correct answer
        </label>
        <Input
          value={data.correctAnswer ?? ''}
          onChange={(e) => onChange({ ...data, correctAnswer: e.target.value })}
          placeholder="The expected answer"
          className="h-11 text-base"
        />
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Also accepted{alts.length > 0 && <span className="ml-1 normal-case tracking-normal text-muted-foreground/70">· {alts.length}</span>}
          </span>
        </div>

        {alts.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {alts.map((a, i) => (
              <div
                key={i}
                className="group inline-flex items-center gap-1 rounded-full border border-border bg-card pl-2.5 pr-1 py-0.5 text-xs"
              >
                <input
                  value={a}
                  onChange={(e) => {
                    const next = alts.map((v, idx) => (idx === i ? e.target.value : v))
                    onChange({ ...data, alternates: next })
                  }}
                  placeholder={`Alternate ${i + 1}`}
                  className="w-32 bg-transparent py-1 text-xs outline-none placeholder:text-muted-foreground"
                />
                <button
                  type="button"
                  onClick={() =>
                    onChange({ ...data, alternates: alts.filter((_, idx) => idx !== i) })
                  }
                  className="rounded-full p-0.5 text-muted-foreground/70 transition-colors hover:bg-destructive/10 hover:text-destructive"
                  aria-label="Remove alternate"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={() => onChange({ ...data, alternates: [...alts, ''] })}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground/70 underline-offset-4 transition-colors hover:text-foreground hover:underline"
        >
          <Plus className="h-3.5 w-3.5" />
          Add alternate
        </button>
      </div>
    </div>
  )
}

/* ----------------------------------------------------------------------
 * Slider — three labeled number inputs side-by-side, plus a live
 * preview slider with the tolerance band shaded in brand lime.
 * -------------------------------------------------------------------- */

export function SliderEditor({
  data,
  onChange,
}: {
  data: SliderData
  onChange: (d: SliderData) => void
}) {
  const min = Number.isFinite(data.min) ? data.min : 0
  const max = Number.isFinite(data.max) ? data.max : 100
  const target = Number.isFinite(data.target) ? data.target : 50
  const tolerance = Number.isFinite(data.tolerance) ? data.tolerance : 0.05

  const range = Math.max(max - min, 1)
  const targetPct = clampPct(((target - min) / range) * 100)
  const halfTolPct = (tolerance * 100) / 2 + (tolerance * 100) / 2 // = tolerance*100; band width = ±tolerance*range
  const bandHalfPct = clampPct(tolerance * 100)
  const bandStart = clampPct(targetPct - bandHalfPct)
  const bandEnd = clampPct(targetPct + bandHalfPct)
  void halfTolPct

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3">
        <NumberField
          label="Min"
          value={min}
          onChange={(v) => onChange({ ...data, min: v })}
        />
        <NumberField
          label="Target"
          value={target}
          onChange={(v) => onChange({ ...data, target: v })}
          accent
        />
        <NumberField
          label="Max"
          value={max}
          onChange={(v) => onChange({ ...data, max: v })}
        />
      </div>

      {/* Live preview track */}
      <div className="space-y-2 rounded-lg border border-border bg-card p-4">
        <div className="flex items-baseline justify-between">
          <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Preview
          </span>
          <span className="font-display text-sm tabular text-muted-foreground">
            ±{((max - min) * tolerance).toFixed(1)} earns full points
          </span>
        </div>

        <div className="relative h-10">
          {/* track */}
          <div className="absolute left-0 right-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-border" />
          {/* tolerance band */}
          <div
            className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-primary/70"
            style={{ left: `${bandStart}%`, width: `${bandEnd - bandStart}%` }}
          />
          {/* target marker */}
          <div
            className="absolute top-1/2 h-5 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground"
            style={{ left: `${targetPct}%` }}
            aria-hidden
          />
        </div>

        <div className="flex justify-between font-display text-xs tabular text-muted-foreground">
          <span>{min}</span>
          <span style={{ color: 'var(--color-foreground)' }}>{target}</span>
          <span>{max}</span>
        </div>
      </div>

      {/* Tolerance slider */}
      <div>
        <div className="mb-1.5 flex items-baseline justify-between">
          <label className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Tolerance
          </label>
          <span className="font-display text-sm tabular">{(tolerance * 100).toFixed(0)}%</span>
        </div>
        <input
          type="range"
          min={1}
          max={50}
          value={Math.round(tolerance * 100)}
          onChange={(e) => onChange({ ...data, tolerance: Number(e.target.value) / 100 })}
          className="w-full accent-primary"
        />
      </div>
    </div>
  )
}

function clampPct(n: number) {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(100, n))
}

function NumberField({
  label,
  value,
  onChange,
  accent,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  accent?: boolean
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={
          'h-11 w-full rounded-md border bg-background px-3 font-display text-lg tabular shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ' +
          (accent
            ? 'border-primary/60 bg-primary/[0.06]'
            : 'border-input')
        }
      />
    </div>
  )
}
