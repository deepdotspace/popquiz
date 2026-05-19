/** Top nav — kahoot brand mark, simple text links, prominent join CTA. */

import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth, AuthOverlay, useUser, signOut } from 'deepspace'
import { ChevronDown, LogOut, Menu, X } from 'lucide-react'
import { type Role } from '../constants'
import { nav } from '../nav'
import { cn } from './ui/utils'

/**
 * Tiny 4-shape rosette used as the brand mark. Hand-rolled SVG so the
 * sacred Kahoot shape colors stay loyal at any size. ~22px square.
 */
function Rosette({ size = 22 }: { size?: number }) {
  const half = size / 2
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 22 22"
      aria-hidden
      className="shrink-0"
    >
      {/* TL: red triangle */}
      <polygon
        points="2.5,9 5.75,2 9,9"
        fill="var(--kahoot-shape-red)"
      />
      {/* TR: blue diamond */}
      <polygon
        points={`${half + 4.25},2 ${half + 7.5},${half - 2} ${half + 4.25},9 ${half + 1},${half - 2}`}
        fill="var(--kahoot-shape-blue)"
      />
      {/* BL: yellow circle */}
      <circle cx="5.75" cy={half + 4.5} r="3.25" fill="var(--kahoot-shape-yellow)" />
      {/* BR: green square */}
      <rect
        x={half + 1}
        y={half + 1.25}
        width="6.5"
        height="6.5"
        rx="0.6"
        fill="var(--kahoot-shape-green)"
      />
    </svg>
  )
}

export default function Navigation() {
  const { isSignedIn } = useAuth()
  const { user } = useUser()
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  const userRole = (user?.role ?? 'anonymous') as Role | 'anonymous'

  useEffect(() => {
    setMobileMenuOpen(false)
    setUserMenuOpen(false)
  }, [location.pathname])

  // Filter the join-game link out of the centred cluster — it gets its own pill on the right.
  const visibleNav = nav.filter((item) => {
    if (item.path === '/play') return false
    if (!item.roles) return true
    if (userRole === 'admin') return true
    return item.roles.includes(userRole as Role)
  })

  return (
    <>
      <nav
        data-testid="app-navigation"
        className="sticky top-0 z-40 border-b border-border bg-background"
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-8 px-4 sm:px-6 lg:px-8">
          {/* Brand */}
          <Link
            to="/home"
            className="flex items-center gap-2.5 shrink-0 group"
            aria-label="Kahoot home"
          >
            <Rosette />
            <span className="font-display text-[19px] font-semibold tracking-tight text-foreground transition-colors group-hover:text-foreground/80">
              kahoot
            </span>
          </Link>

          {/* Primary nav (desktop) — plain text, animated underline on active */}
          <div className="hidden md:flex items-center gap-7">
            {visibleNav.map((item) => {
              const active = location.pathname.startsWith(item.path)
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  aria-current={active ? 'page' : undefined}
                  className="group relative py-1 text-[14px] font-medium tracking-tight"
                >
                  <span
                    className={cn(
                      'transition-colors',
                      active ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground',
                    )}
                  >
                    {item.label}
                  </span>
                  {/* Animated ink underline */}
                  <span
                    aria-hidden
                    className={cn(
                      'absolute -bottom-0.5 left-0 right-0 h-[2px] origin-left bg-foreground transition-transform duration-300 ease-out',
                      active ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100',
                    )}
                    style={{
                      transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
                    }}
                  />
                </Link>
              )
            })}
          </div>

          <div className="flex-1" />

          {/* Right cluster — Join pill is always visible */}
          <div className="flex items-center gap-3">
            <Link
              to="/play"
              data-testid="nav-join-game"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-[13px] font-semibold tracking-tight text-primary-foreground shadow-[0_1px_0_rgba(0,0,0,0.05)] transition-transform hover:-translate-y-px"
            >
              Join a game
              <span className="tabular text-[11px] font-bold opacity-70">PIN</span>
            </Link>

            {isSignedIn && user ? (
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen((prev) => !prev)}
                  aria-haspopup="menu"
                  aria-expanded={userMenuOpen}
                  className="group flex items-center gap-2 rounded-full border border-border bg-card pl-1 pr-2.5 py-1 text-sm transition-colors hover:bg-secondary"
                >
                  <span className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-muted text-[11px] font-semibold text-muted-foreground">
                    {user.imageUrl ? (
                      <img
                        src={user.imageUrl}
                        alt=""
                        referrerPolicy="no-referrer"
                        className="h-full w-full rounded-full object-cover"
                      />
                    ) : (
                      (user.name?.[0] ?? user.email?.[0] ?? '?').toUpperCase()
                    )}
                  </span>
                  <span
                    data-testid="nav-user-name"
                    className="hidden max-w-[120px] truncate text-foreground sm:inline"
                  >
                    {user.name || user.email}
                  </span>
                  <ChevronDown
                    className={cn(
                      'h-3.5 w-3.5 text-muted-foreground transition-transform duration-200',
                      userMenuOpen && 'rotate-180',
                    )}
                    aria-hidden
                  />
                </button>
                {userMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setUserMenuOpen(false)}
                      aria-hidden
                    />
                    <div
                      role="menu"
                      className="absolute right-0 top-[calc(100%+8px)] z-50 w-60 overflow-hidden rounded-2xl border border-border bg-card shadow-card-hover"
                    >
                      <div className="border-b border-border px-4 py-3">
                        <div className="truncate text-sm font-medium text-foreground">
                          {user.name || 'Signed in'}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {user.email}
                        </div>
                      </div>
                      <button
                        role="menuitem"
                        onClick={() => { setUserMenuOpen(false); signOut() }}
                        className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                      >
                        <LogOut className="h-3.5 w-3.5" aria-hidden />
                        Sign out
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <button
                data-testid="nav-sign-in-button"
                onClick={() => setShowAuthModal(true)}
                className="rounded-full bg-foreground px-4 py-2 text-[13px] font-semibold tracking-tight text-background transition-opacity hover:opacity-90"
              >
                Sign in
              </button>
            )}

            <button
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground md:hidden"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-label="Toggle menu"
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? (
                <X className="h-4 w-4" aria-hidden />
              ) : (
                <Menu className="h-4 w-4" aria-hidden />
              )}
            </button>
          </div>
        </div>

        {/* Mobile dropdown */}
        <div
          className={cn(
            'overflow-hidden border-t border-border bg-background transition-[max-height,opacity] duration-200 ease-out md:hidden',
            mobileMenuOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0',
          )}
        >
          <div className="space-y-0.5 px-3 py-2">
            {visibleNav.map((item) => {
              const active = location.pathname.startsWith(item.path)
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'block rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                    active
                      ? 'bg-secondary text-foreground'
                      : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground',
                  )}
                >
                  {item.label}
                </Link>
              )
            })}
            <Link
              to="/play"
              className="block rounded-lg bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground"
            >
              Join a game
            </Link>
          </div>
        </div>
      </nav>

      {showAuthModal && <AuthOverlay onClose={() => setShowAuthModal(false)} />}
    </>
  )
}
