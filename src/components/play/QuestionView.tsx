/**
 * QuestionView — phase C of the player flow.
 *
 * Iconic Kahoot rule: the player phone shows NO question text. Players look
 * up at the host screen to read it. This component just presents the input
 * affordances (4 shapes / true-false / type / slider) plus a "locked in"
 * confirmation once they've answered.
 */

import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Question } from '../../lib/types'
import { SHAPE_COLORS } from '../../lib/quiz-types'
import { Shape } from './Shape'

export type QuestionAnswerPayload =
  | { optionIndex: number }
  | { textAnswer: string }
  | { numberAnswer: number }

interface QuestionViewProps {
  question: Question
  questionStartedAt: number
  onSubmit: (payload: QuestionAnswerPayload) => Promise<void> | void
  alreadyAnswered: boolean
  myOptionIndex?: number | null
  myTextAnswer?: string | null
  myNumberAnswer?: number | null
}

const EASE = [0.16, 1, 0.3, 1] as const

export function QuestionView({
  question,
  onSubmit,
  alreadyAnswered,
  myOptionIndex,
  myTextAnswer,
  myNumberAnswer,
}: QuestionViewProps) {
  const data = useMemo(() => {
    try {
      return JSON.parse(question.data || '{}')
    } catch {
      return {}
    }
  }, [question.data])

  if (alreadyAnswered) {
    return (
      <LockedIn
        question={question}
        data={data}
        optionIndex={myOptionIndex ?? null}
        textAnswer={myTextAnswer ?? null}
        numberAnswer={myNumberAnswer ?? null}
      />
    )
  }

  if (question.type === 'mcq' || question.type === 'poll') {
    const options: { text: string }[] = data?.options ?? []
    return <McqGrid options={options} onPick={(i) => onSubmit({ optionIndex: i })} />
  }
  if (question.type === 'true_false') {
    return <TrueFalse onPick={(i) => onSubmit({ optionIndex: i })} />
  }
  if (question.type === 'type_answer') {
    return <TypeAnswer onSend={(text) => onSubmit({ textAnswer: text })} />
  }
  if (question.type === 'slider') {
    return (
      <SliderInput
        min={data?.min ?? 0}
        max={data?.max ?? 100}
        onSend={(n) => onSubmit({ numberAnswer: n })}
      />
    )
  }
  return (
    <div
      className="flex h-full w-full items-center justify-center p-6 text-center"
      style={{ color: 'var(--kahoot-stage)' }}
    >
      Unsupported question type.
    </div>
  )
}

// ── 4-shape grid ────────────────────────────────────────────────────────────

function McqGrid({
  options,
  onPick,
}: {
  options: { text: string }[]
  onPick: (i: number) => void
}) {
  const [pressed, setPressed] = useState<number | null>(null)
  const slots = Array.from({ length: 4 }).map((_, i) => options[i])

  function tap(i: number) {
    if (pressed != null) return
    setPressed(i)
    // tiny delay so the press animation reads
    setTimeout(() => onPick(i), 110)
  }

  return (
    <div
      className="grid h-full w-full grid-cols-2 grid-rows-2 gap-1"
      style={{ background: 'var(--kahoot-stage)' }}
    >
      {slots.map((opt, i) => {
        const c = SHAPE_COLORS[i]
        const disabled = !opt
        const isPicked = pressed === i
        const isOther = pressed != null && pressed !== i
        return (
          <motion.button
            key={i}
            type="button"
            disabled={disabled || pressed != null}
            onClick={() => tap(i)}
            aria-label={`Answer ${c.label}`}
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{
              scale: isPicked ? 0.96 : 1,
              opacity: isOther ? 0.25 : 1,
            }}
            transition={{ duration: 0.28, ease: EASE }}
            whileTap={!disabled && pressed == null ? { scale: 0.94 } : undefined}
            className="relative flex items-center justify-center overflow-hidden disabled:opacity-25"
            style={{ backgroundColor: c.color }}
          >
            <Shape
              shape={c.name}
              className="text-white"
              style={{ width: '52%', height: '52%' }}
            />
          </motion.button>
        )
      })}
    </div>
  )
}

// ── True / False ────────────────────────────────────────────────────────────

function TrueFalse({ onPick }: { onPick: (i: number) => void }) {
  const [pressed, setPressed] = useState<number | null>(null)

  function tap(i: number) {
    if (pressed != null) return
    setPressed(i)
    setTimeout(() => onPick(i), 110)
  }

  return (
    <div
      className="grid h-full w-full grid-rows-2 gap-1"
      style={{ background: 'var(--kahoot-stage)' }}
    >
      {(['True', 'False'] as const).map((label, i) => {
        const c = SHAPE_COLORS[i]
        const isOther = pressed != null && pressed !== i
        const isPicked = pressed === i
        return (
          <motion.button
            key={label}
            type="button"
            disabled={pressed != null}
            onClick={() => tap(i)}
            aria-label={label}
            animate={{ scale: isPicked ? 0.97 : 1, opacity: isOther ? 0.25 : 1 }}
            transition={{ duration: 0.28, ease: EASE }}
            whileTap={pressed == null ? { scale: 0.96 } : undefined}
            className="flex items-center justify-center"
            style={{ backgroundColor: c.color }}
          >
            <Shape
              shape={c.name}
              className="text-white"
              style={{ width: '38%', height: '38%' }}
            />
          </motion.button>
        )
      })}
    </div>
  )
}

// ── Type answer ─────────────────────────────────────────────────────────────

function TypeAnswer({ onSend }: { onSend: (text: string) => void }) {
  const [text, setText] = useState('')

  function submit() {
    const v = text.trim()
    if (!v) return
    onSend(v)
  }

  return (
    <div
      className="flex h-full w-full flex-col px-5 pb-6 pt-8"
      style={{
        background: 'var(--kahoot-spotlight)',
        color: 'var(--kahoot-stage)',
      }}
    >
      <div
        className="text-[11px] font-medium uppercase"
        style={{ letterSpacing: '0.28em', opacity: 0.55 }}
      >
        Your answer
      </div>

      <div className="flex flex-1 items-center">
        <input
          type="text"
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit()
          }}
          placeholder="Tap to type"
          className="w-full bg-transparent font-display outline-none"
          style={{
            color: 'var(--kahoot-stage)',
            fontSize: 'clamp(40px, 11vw, 72px)',
            fontWeight: 700,
            letterSpacing: '-0.025em',
            lineHeight: 1.05,
          }}
        />
      </div>

      <motion.button
        type="button"
        onClick={submit}
        disabled={text.trim().length === 0}
        whileTap={text.trim().length > 0 ? { scale: 0.98 } : undefined}
        className="w-full rounded-[24px] py-5 font-display text-2xl font-bold transition-opacity disabled:opacity-40"
        style={{
          background: 'var(--kahoot-stage)',
          color: 'var(--kahoot-spotlight)',
          minHeight: '64px',
        }}
      >
        Submit
      </motion.button>
    </div>
  )
}

// ── Slider ──────────────────────────────────────────────────────────────────

function SliderInput({
  min,
  max,
  onSend,
}: {
  min: number
  max: number
  onSend: (n: number) => void
}) {
  const [val, setVal] = useState(Math.round((min + max) / 2))
  return (
    <div
      className="flex h-full w-full flex-col px-5 pb-6 pt-8"
      style={{
        background: 'var(--kahoot-spotlight)',
        color: 'var(--kahoot-stage)',
      }}
    >
      <div
        className="text-[11px] font-medium uppercase"
        style={{ letterSpacing: '0.28em', opacity: 0.55 }}
      >
        Your guess
      </div>

      <div className="flex flex-1 flex-col items-center justify-center">
        <div
          className="font-display tabular"
          style={{
            fontSize: 'clamp(80px, 26vw, 180px)',
            fontWeight: 700,
            letterSpacing: '-0.04em',
            lineHeight: 1,
          }}
        >
          {val}
        </div>

        <input
          type="range"
          min={min}
          max={max}
          value={val}
          onChange={(e) => setVal(Number(e.target.value))}
          className="mt-8 w-full"
          style={{ accentColor: 'var(--kahoot-stage)' }}
        />
        <div
          className="mt-2 flex w-full justify-between font-display tabular text-base font-medium"
          style={{ opacity: 0.55 }}
        >
          <span>{min}</span>
          <span>{max}</span>
        </div>
      </div>

      <motion.button
        type="button"
        onClick={() => onSend(val)}
        whileTap={{ scale: 0.98 }}
        className="w-full rounded-[24px] py-5 font-display text-2xl font-bold"
        style={{
          background: 'var(--kahoot-stage)',
          color: 'var(--kahoot-spotlight)',
          minHeight: '64px',
        }}
      >
        Submit
      </motion.button>
    </div>
  )
}

// ── Locked-in confirmation ─────────────────────────────────────────────────

function LockedIn({
  question,
  data,
  optionIndex,
  textAnswer,
  numberAnswer,
}: {
  question: Question
  data: { options?: { text: string }[] }
  optionIndex: number | null
  textAnswer: string | null
  numberAnswer: number | null
}) {
  const isShape =
    question.type === 'mcq' ||
    question.type === 'poll' ||
    question.type === 'true_false'

  let shapeIdx: number | null = null
  let summary: string | null = null

  if (isShape && optionIndex != null) {
    shapeIdx = optionIndex
  } else if (textAnswer) {
    summary = textAnswer
  } else if (numberAnswer != null) {
    summary = String(numberAnswer)
  }

  const tint =
    shapeIdx != null
      ? SHAPE_COLORS[shapeIdx]?.color
      : 'var(--kahoot-stage)'

  return (
    <motion.div
      key="locked-in"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25, ease: EASE }}
      className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden px-6"
      style={{
        backgroundColor: tint,
        color: '#ffffff',
      }}
    >
      {shapeIdx != null && (
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, ease: EASE }}
        >
          <Shape
            shape={SHAPE_COLORS[shapeIdx].name}
            className="text-white"
            style={{ width: '180px', height: '180px' }}
          />
        </motion.div>
      )}

      {summary && (
        <div
          className="font-display max-w-[20ch] text-center"
          style={{
            fontSize: 'clamp(40px, 11vw, 72px)',
            fontWeight: 700,
            letterSpacing: '-0.025em',
            lineHeight: 1.05,
            wordBreak: 'break-word',
          }}
        >
          {summary}
        </div>
      )}

      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.55, ease: EASE, delay: 0.15 }}
        className="absolute bottom-10 inline-flex items-center gap-3 rounded-full px-5 py-3 font-display text-base font-bold"
        style={{
          background: 'rgba(255,255,255,0.92)',
          color: 'var(--kahoot-stage)',
        }}
      >
        Locked in
        {shapeIdx != null && (
          <Shape
            shape={SHAPE_COLORS[shapeIdx].name}
            style={{
              width: '20px',
              height: '20px',
              color: SHAPE_COLORS[shapeIdx].color,
            }}
          />
        )}
      </motion.div>
    </motion.div>
  )
}
