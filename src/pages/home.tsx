import { useState, useRef, useEffect } from 'react'
import { useAuth, AuthOverlay } from 'deepspace'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { MadeWithDeepSpace } from '../components/MadeWithDeepSpace'

/**
 * Public landing — editorial headline, live PIN entry strip, and a
 * triptych of numbered "spreads" instead of icon-card features.
 *
 * Solid warm bone background. The four sacred shape colors appear
 * subtly behind the hero and as decorative numerals in the triptych.
 */
export default function HomePage() {
  const { isSignedIn } = useAuth()
  const navigate = useNavigate()
  const [showAuth, setShowAuth] = useState(false)
  const [pin, setPin] = useState('')
  const [pinError, setPinError] = useState(false)
  const pinInputRef = useRef<HTMLInputElement>(null)

  function onCreate(e: React.MouseEvent) {
    e.preventDefault()
    if (isSignedIn) navigate('/quizzes')
    else setShowAuth(true)
  }

  function submitPin(e: React.FormEvent) {
    e.preventDefault()
    const cleaned = pin.replace(/\D/g, '').slice(0, 6)
    if (cleaned.length < 4) {
      setPinError(true)
      window.setTimeout(() => setPinError(false), 600)
      pinInputRef.current?.focus()
      return
    }
    navigate(`/play/${cleaned}`)
  }

  return (
    <div className="relative min-h-full overflow-hidden bg-background text-foreground">
      <HeroShapes />

      {/* HERO */}
      <section className="relative mx-auto max-w-6xl px-6 pt-14 pb-20 sm:pt-20 sm:pb-28">
        <div className="relative">
          <p className="mb-7 inline-flex items-center gap-2 text-[13px] font-medium tracking-tight text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            A live quiz platform, calmly authored
          </p>

          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="font-display font-semibold text-foreground text-balance leading-[0.92]"
            style={{
              fontSize: 'clamp(2.75rem, 8vw, 7rem)',
              letterSpacing: '-0.035em',
            }}
          >
            Make every lesson
            <br />
            the room is{' '}
            <span className="relative inline-block">
              waiting for.
              {/* Hand-drawn underline accent in lime */}
              <svg
                aria-hidden
                viewBox="0 0 320 14"
                preserveAspectRatio="none"
                className="absolute -bottom-1 left-0 h-[0.18em] w-full"
              >
                <path
                  d="M2 8 C 60 2, 130 12, 200 6 S 300 4, 318 9"
                  stroke="var(--color-primary)"
                  strokeWidth="6"
                  strokeLinecap="round"
                  fill="none"
                />
              </svg>
            </span>
          </motion.h1>

          <p className="mt-7 max-w-2xl text-balance text-[17px] leading-relaxed text-muted-foreground sm:text-lg">
            Author quizzes calmly at your desk, then host them like a stage
            manager. Players join from any phone — no app, no login, just a PIN.
          </p>

          {/* PIN strip + secondary CTA */}
          <div className="mt-12 flex flex-col gap-5 lg:flex-row lg:items-end">
            <motion.form
              onSubmit={submitPin}
              animate={pinError ? { x: [0, -8, 8, -6, 4, 0] } : { x: 0 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="group relative flex w-full max-w-xl items-stretch overflow-hidden rounded-2xl border-2 border-foreground bg-card shadow-[6px_6px_0_var(--color-foreground)] transition-shadow focus-within:shadow-[8px_8px_0_var(--color-primary)]"
            >
              <button
                type="submit"
                className="flex shrink-0 select-none items-center border-r-2 border-foreground bg-foreground px-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-background transition-colors hover:bg-primary hover:text-primary-foreground"
                aria-label="Join game"
              >
                Enter PIN
              </button>
              <input
                id="pin-input"
                ref={pinInputRef}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="000000"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="tabular font-display flex-1 bg-transparent px-5 py-5 text-3xl font-semibold tracking-[0.18em] text-foreground placeholder:text-muted-foreground/40 focus:outline-none sm:text-4xl"
                aria-label="Game PIN"
              />
            </motion.form>

            <a
              href="/quizzes"
              onClick={onCreate}
              className="inline-flex items-center gap-1.5 self-start text-[15px] font-medium tracking-tight text-foreground underline-offset-[6px] hover:underline lg:self-auto lg:pb-3"
            >
              Or create a kahoot
              <ArrowRight className="h-4 w-4" aria-hidden />
            </a>
          </div>
        </div>
      </section>

      {/* DIVIDER w/ marquee-like dot run */}
      <Divider />

      {/* TRIPTYCH — three editorial spreads, not three icon-cards */}
      <section className="mx-auto max-w-6xl px-6 py-20 sm:py-28">
        <div className="mb-14 flex items-end justify-between gap-6">
          <h2 className="font-display max-w-md text-[2rem] font-semibold leading-[1.05] tracking-tight sm:text-[2.5rem]">
            Three steps. Calm at the desk, electric on the stage.
          </h2>
          <span className="hidden text-[12px] font-medium tracking-[0.2em] text-muted-foreground uppercase sm:inline">
            How it runs
          </span>
        </div>

        <div className="grid gap-x-10 gap-y-14 md:grid-cols-3">
          <Spread
            num="01"
            title="Author with AI"
            line="Drop a topic or paste a URL. A draft kahoot lands in seconds — yours to edit, never just to ship."
            shapeColor="var(--kahoot-shape-red)"
            diagram={
              <svg viewBox="0 0 200 110" className="h-full w-full" aria-hidden>
                <line x1="20" y1="22" x2="180" y2="22" stroke="currentColor" strokeWidth="2" />
                <line x1="20" y1="42" x2="140" y2="42" stroke="currentColor" strokeWidth="2" opacity="0.55" />
                <line x1="20" y1="62" x2="160" y2="62" stroke="currentColor" strokeWidth="2" opacity="0.55" />
                <line x1="20" y1="82" x2="100" y2="82" stroke="currentColor" strokeWidth="2" opacity="0.55" />
                <polygon
                  points="170,72 184,72 177,86"
                  fill="var(--kahoot-shape-red)"
                />
              </svg>
            }
          />
          <Spread
            num="02"
            title="Host live"
            line="Project to the wall, share the PIN, and run the room. The host screen does the heavy lifting — you stay the conductor."
            shapeColor="var(--kahoot-shape-blue)"
            diagram={
              <svg viewBox="0 0 200 110" className="h-full w-full" aria-hidden>
                <rect x="20" y="14" width="160" height="70" rx="6" fill="none" stroke="currentColor" strokeWidth="2" />
                <line x1="40" y1="36" x2="120" y2="36" stroke="currentColor" strokeWidth="2" />
                <line x1="40" y1="52" x2="100" y2="52" stroke="currentColor" strokeWidth="2" opacity="0.4" />
                <polygon
                  points="100,98 110,90 110,106"
                  fill="var(--kahoot-shape-blue)"
                />
                <line x1="100" y1="84" x2="100" y2="98" stroke="currentColor" strokeWidth="2" />
              </svg>
            }
          />
          <Spread
            num="03"
            title="Score in real time"
            line="Speed-weighted points, streak bonuses, leaderboards that animate. The recap shows up in Reports the second the game ends."
            shapeColor="var(--kahoot-shape-green)"
            diagram={
              <svg viewBox="0 0 200 110" className="h-full w-full" aria-hidden>
                <line x1="20" y1="92" x2="180" y2="92" stroke="currentColor" strokeWidth="2" />
                <rect x="34" y="60" width="22" height="32" fill="var(--kahoot-shape-yellow)" />
                <rect x="68" y="40" width="22" height="52" fill="var(--kahoot-shape-green)" />
                <rect x="102" y="22" width="22" height="70" fill="var(--kahoot-shape-blue)" />
                <rect x="136" y="50" width="22" height="42" fill="var(--kahoot-shape-red)" />
              </svg>
            }
          />
        </div>
      </section>

      <Divider />

      {/* SECONDARY CTA — quiet */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
          <div>
            <p className="font-display text-[2rem] font-semibold leading-[1.05] tracking-tight text-foreground sm:text-[2.5rem]">
              Ready when the room is.
            </p>
            <p className="mt-2 max-w-md text-[15px] text-muted-foreground">
              Sign up, draft a quiz, project it to the wall. Your students bring the noise.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/play"
              className="rounded-full border border-foreground px-5 py-2.5 text-[14px] font-semibold text-foreground transition-colors hover:bg-foreground hover:text-background"
            >
              Join a game
            </Link>
            <a
              href="/quizzes"
              onClick={onCreate}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-2.5 text-[14px] font-semibold text-primary-foreground transition-transform hover:-translate-y-px"
            >
              Create a kahoot
              <ArrowRight className="h-4 w-4" aria-hidden />
            </a>
          </div>
        </div>
      </section>

      <footer className="mx-auto max-w-6xl px-6 pb-10 pt-4">
        <div className="flex flex-col items-start gap-4 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
          <MadeWithDeepSpace />
          <p className="text-[12px] text-muted-foreground">
            © 2026 · Not affiliated with Kahoot!
          </p>
        </div>
      </footer>

      {showAuth && <AuthOverlay onClose={() => setShowAuth(false)} />}
    </div>
  )
}

/**
 * The four sacred shapes, oversized and rotated, sitting behind the hero
 * at low opacity. They subtly punch through on hover.
 */
function HeroShapes() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute right-0 top-0 hidden h-[680px] w-[55%] overflow-hidden lg:block"
    >
      {/* Red triangle */}
      <svg
        className="absolute right-[-40px] top-24 transition-opacity duration-700"
        width="220"
        height="220"
        viewBox="0 0 100 100"
        style={{ transform: 'rotate(8deg)', opacity: 0.08 }}
      >
        <polygon points="50,5 95,90 5,90" fill="var(--kahoot-shape-red)" />
      </svg>
      {/* Blue diamond */}
      <svg
        className="absolute right-[210px] top-[60px]"
        width="160"
        height="160"
        viewBox="0 0 100 100"
        style={{ transform: 'rotate(-6deg)', opacity: 0.07 }}
      >
        <polygon points="50,5 95,50 50,95 5,50" fill="var(--kahoot-shape-blue)" />
      </svg>
      {/* Yellow circle */}
      <svg
        className="absolute right-[60px] top-[330px]"
        width="180"
        height="180"
        viewBox="0 0 100 100"
        style={{ opacity: 0.09 }}
      >
        <circle cx="50" cy="50" r="45" fill="var(--kahoot-shape-yellow)" />
      </svg>
      {/* Green square */}
      <svg
        className="absolute right-[260px] top-[300px]"
        width="140"
        height="140"
        viewBox="0 0 100 100"
        style={{ transform: 'rotate(12deg)', opacity: 0.08 }}
      >
        <rect x="8" y="8" width="84" height="84" rx="6" fill="var(--kahoot-shape-green)" />
      </svg>
    </div>
  )
}

function Divider() {
  return (
    <div aria-hidden className="mx-auto max-w-6xl px-6">
      <div className="flex items-center gap-2 border-t border-border pt-1">
        <DotRow />
      </div>
    </div>
  )
}

function DotRow() {
  // Repeating run of the four shape colors as tiny rectangles.
  const colors = [
    'var(--kahoot-shape-red)',
    'var(--kahoot-shape-blue)',
    'var(--kahoot-shape-yellow)',
    'var(--kahoot-shape-green)',
  ]
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => (t + 1) % 4), 1800)
    return () => window.clearInterval(id)
  }, [])
  return (
    <div className="flex items-center gap-1.5 py-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <span
          key={i}
          className="h-1 w-1 rounded-full transition-all duration-500"
          style={{
            backgroundColor: colors[(i + tick) % 4],
            opacity: 0.55,
          }}
        />
      ))}
    </div>
  )
}

interface SpreadProps {
  num: string
  title: string
  line: string
  shapeColor: string
  diagram: React.ReactNode
}

function Spread({ num, title, line, shapeColor, diagram }: SpreadProps) {
  return (
    <article className="group relative flex flex-col">
      <div className="flex items-baseline gap-3">
        <span
          className="font-display tabular text-[3rem] font-semibold leading-none tracking-tight"
          style={{ color: shapeColor }}
        >
          {num}
        </span>
        <span className="h-[1px] flex-1 bg-border" />
      </div>
      <h3 className="font-display mt-5 text-[1.65rem] font-semibold leading-[1.05] tracking-tight text-foreground">
        {title}
      </h3>
      <p className="mt-2.5 text-[14.5px] leading-relaxed text-muted-foreground">
        {line}
      </p>
      <div className="mt-7 h-[110px] w-full text-foreground/55 transition-colors group-hover:text-foreground/80">
        {diagram}
      </div>
    </article>
  )
}
