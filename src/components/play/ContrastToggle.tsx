/**
 * High-contrast theme toggle. Persists to localStorage and toggles
 * `data-contrast="high"` on <html>. Tiny eye button in the top-right;
 * subtle ink fill normally, lime-filled when active.
 */

import { useEffect, useState } from 'react'
import { Eye } from 'lucide-react'

const STORAGE_KEY = 'popquiz:contrast'

export function ContrastToggle() {
  const [high, setHigh] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) === 'high'
    setHigh(saved)
    if (saved) document.documentElement.setAttribute('data-contrast', 'high')
  }, [])

  function toggle() {
    const next = !high
    setHigh(next)
    if (next) {
      document.documentElement.setAttribute('data-contrast', 'high')
      localStorage.setItem(STORAGE_KEY, 'high')
    } else {
      document.documentElement.removeAttribute('data-contrast')
      localStorage.removeItem(STORAGE_KEY)
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={high ? 'Disable high contrast' : 'Enable high contrast'}
      aria-pressed={high}
      className="fixed right-3 top-3 z-50 inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors"
      style={
        high
          ? {
              background: 'var(--pq-spotlight)',
              color: 'var(--pq-stage)',
            }
          : {
              background: 'var(--pq-stage)',
              color: 'var(--pq-stage-paper)',
              opacity: 0.55,
            }
      }
    >
      <Eye className="h-[18px] w-[18px]" aria-hidden />
    </button>
  )
}
