/**
 * /play — PIN entry. Mobile-first, lime brand surface.
 *
 * One huge tabular input, autoFocus to pop the numeric keyboard. Auto-navigates
 * once 6 digits are typed. The PIN is the only thing on the screen.
 *
 * Optional `?pin=XXXXXX` prefills (for shareable QR links).
 */

import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ContrastToggle } from '../../../components/play/ContrastToggle'

export default function PlayIndexPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [pin, setPin] = useState('')
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    const fromQuery = params.get('pin')
    if (fromQuery && /^\d{1,6}$/.test(fromQuery)) setPin(fromQuery)
  }, [params])

  // Auto-navigate as soon as 6 digits are typed.
  useEffect(() => {
    if (/^\d{6}$/.test(pin)) {
      const t = setTimeout(() => navigate(`/play/${pin}`), 120)
      return () => clearTimeout(t)
    }
  }, [pin, navigate])

  function submit(e?: React.FormEvent) {
    e?.preventDefault()
    if (!/^\d{6}$/.test(pin)) return
    navigate(`/play/${pin}`)
  }

  return (
    <div
      className="relative flex flex-col"
      style={{
        minHeight: '100dvh',
        background: 'var(--kahoot-spotlight)',
        color: 'var(--kahoot-stage)',
      }}
    >
      <ContrastToggle />

      <a
        href="/"
        className="absolute left-3 top-3 z-10 rounded-full px-3 py-1.5 text-xs font-medium opacity-70 hover:opacity-100"
        style={{ color: 'var(--kahoot-stage)' }}
      >
        ← Home
      </a>

      <form
        onSubmit={submit}
        className="flex flex-1 flex-col items-center justify-center px-6 py-10"
        onClick={() => inputRef.current?.focus()}
      >
        <div
          className="font-display text-base font-medium uppercase"
          style={{
            letterSpacing: '0.32em',
            color: 'var(--kahoot-stage)',
            opacity: 0.65,
          }}
        >
          Game PIN
        </div>

        <input
          ref={inputRef}
          type="text"
          value={pin}
          inputMode="numeric"
          pattern="\d*"
          maxLength={6}
          autoFocus
          autoComplete="one-time-code"
          onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
          aria-label="Game PIN"
          placeholder="––––––"
          className="mt-4 w-full max-w-[420px] bg-transparent text-center font-display tabular outline-none"
          style={{
            color: 'var(--kahoot-stage)',
            // Fluid: ~70px on a 375 phone, scaling up on larger screens.
            fontSize: 'clamp(64px, 22vw, 140px)',
            fontWeight: 700,
            letterSpacing: '0.08em',
            lineHeight: 1,
            caretColor: 'var(--kahoot-stage)',
          }}
        />

        <button
          type="submit"
          aria-hidden
          tabIndex={-1}
          className="sr-only"
        >
          Enter
        </button>
      </form>
    </div>
  )
}
