/**
 * NicknamePicker — phase A. Lime-to-bone surface, three large pills (with
 * a flip animation when re-rolling) or a single big text input.
 */

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { nicknameOptions } from '../../lib/nicknames'
import { validateNickname } from '../../lib/profanity'

interface NicknamePickerProps {
  pin: string
  generatorEnabled: boolean
  teamMode: boolean
  onSubmit: (args: { nickname: string; teamName?: string }) => Promise<void>
  submitting: boolean
  error?: string | null
}

const EASE = [0.16, 1, 0.3, 1] as const

export function NicknamePicker({
  pin,
  generatorEnabled,
  teamMode,
  onSubmit,
  submitting,
  error,
}: NicknamePickerProps) {
  const [options, setOptions] = useState<string[]>(() => nicknameOptions(3))
  const [optionsKey, setOptionsKey] = useState(0)
  const [picked, setPicked] = useState<string | null>(null)
  const [typed, setTyped] = useState('')
  const [teamName, setTeamName] = useState('')

  const candidate = generatorEnabled ? picked ?? '' : typed
  const validation = candidate
    ? validateNickname(candidate)
    : ({ ok: false, reason: '' } as { ok: false; reason: string })
  const canSubmit =
    validation.ok && (!teamMode || teamName.trim().length >= 2) && !submitting

  useEffect(() => {
    if (generatorEnabled && !options.includes(picked ?? '')) setPicked(null)
  }, [options, picked, generatorEnabled])

  function reroll() {
    setOptions(nicknameOptions(3))
    setOptionsKey((k) => k + 1)
    setPicked(null)
  }

  async function handleJoin() {
    if (!canSubmit) return
    await onSubmit({
      nickname: candidate.trim(),
      teamName: teamMode ? teamName.trim() : undefined,
    })
  }

  return (
    <div
      className="relative flex flex-col px-5 pb-6 pt-12"
      style={{
        minHeight: '100dvh',
        background:
          'linear-gradient(180deg, var(--kahoot-spotlight) 0%, var(--kahoot-spotlight) 28%, var(--kahoot-stage-paper) 80%)',
        color: 'var(--kahoot-stage)',
      }}
    >
      <div className="flex items-center justify-between">
        <div
          className="text-[11px] font-medium uppercase"
          style={{ letterSpacing: '0.28em', opacity: 0.6 }}
        >
          PIN
        </div>
        <div className="font-display tabular text-2xl font-bold" style={{ letterSpacing: '0.06em' }}>
          {pin}
        </div>
      </div>

      <h1
        className="font-display mt-10 text-[40px] font-bold leading-[0.95]"
        style={{ letterSpacing: '-0.025em' }}
      >
        Pick your
        <br />
        nickname.
      </h1>

      <div className="mt-8 flex-1">
        {generatorEnabled ? (
          <AnimatePresence mode="wait">
            <motion.div
              key={optionsKey}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35, ease: EASE }}
              className="space-y-3"
            >
              {options.map((opt, i) => {
                const active = picked === opt
                return (
                  <motion.button
                    key={opt}
                    type="button"
                    onClick={() => setPicked(opt)}
                    initial={{ opacity: 0, rotateX: -45, y: 12 }}
                    animate={{ opacity: 1, rotateX: 0, y: 0 }}
                    transition={{ duration: 0.4, delay: i * 0.06, ease: EASE }}
                    whileTap={{ scale: 0.98 }}
                    className="block w-full rounded-[20px] px-6 py-5 text-left font-display text-[22px] font-bold transition-colors"
                    style={
                      active
                        ? {
                            background: 'var(--kahoot-stage)',
                            color: 'var(--kahoot-spotlight)',
                          }
                        : {
                            background: 'rgba(255,255,255,0.55)',
                            color: 'var(--kahoot-stage)',
                            boxShadow: 'inset 0 0 0 2px rgba(20,18,30,0.08)',
                          }
                    }
                  >
                    {opt}
                  </motion.button>
                )
              })}
              <button
                type="button"
                onClick={reroll}
                aria-label="New nickname options"
                className="mx-auto mt-3 flex h-12 w-12 items-center justify-center rounded-full text-2xl"
                style={{
                  background: 'rgba(20,18,30,0.06)',
                }}
              >
                <span aria-hidden>🎲</span>
              </button>
            </motion.div>
          </AnimatePresence>
        ) : (
          <div>
            <input
              type="text"
              autoFocus
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="Type a name"
              maxLength={20}
              className="w-full bg-transparent font-display outline-none"
              style={{
                fontSize: 'clamp(36px, 9vw, 56px)',
                fontWeight: 700,
                letterSpacing: '-0.02em',
                color: 'var(--kahoot-stage)',
                borderBottom: '3px solid rgba(20,18,30,0.15)',
                paddingBottom: '12px',
              }}
            />
            {typed && !validation.ok && validation.reason && (
              <div
                className="mt-3 text-sm font-medium"
                style={{ color: 'var(--color-destructive)' }}
              >
                {validation.reason}
              </div>
            )}
          </div>
        )}

        {teamMode && (
          <div className="mt-6">
            <div
              className="text-[11px] font-medium uppercase"
              style={{ letterSpacing: '0.22em', opacity: 0.55 }}
            >
              Team
            </div>
            <input
              type="text"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="Red Falcons"
              maxLength={30}
              className="mt-2 w-full bg-transparent font-display text-2xl font-bold outline-none"
              style={{
                color: 'var(--kahoot-stage)',
                borderBottom: '2px solid rgba(20,18,30,0.15)',
                paddingBottom: '8px',
              }}
            />
          </div>
        )}

        {error && (
          <div
            className="mt-5 rounded-2xl px-4 py-3 text-sm font-medium"
            style={{
              background: 'color-mix(in oklch, var(--color-destructive) 12%, transparent)',
              color: 'var(--color-destructive)',
            }}
          >
            {error}
          </div>
        )}
      </div>

      <motion.button
        type="button"
        onClick={handleJoin}
        disabled={!canSubmit}
        whileTap={canSubmit ? { scale: 0.98 } : undefined}
        className="mt-6 w-full rounded-[24px] py-5 font-display text-2xl font-bold transition-opacity disabled:opacity-40"
        style={{
          background: 'var(--kahoot-spotlight)',
          color: 'var(--kahoot-stage)',
          minHeight: '64px',
        }}
      >
        {submitting ? 'Joining…' : 'Join'}
      </motion.button>
    </div>
  )
}
