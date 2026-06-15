/**
 * "Made with DeepSpace" credit badge.
 *
 * Links out to deep.space (with launch UTM params). Styled to sit inside the
 * PopQuiz theme — warm card surface, navy ink, the rounded-pill language used
 * by the nav's Join button — while keeping a DeepSpace signature: a small
 * star/sparkle mark that lights up in brand lime on hover (our one accent
 * "punctuation mark").
 *
 * Kept off the live host stage and the player phone on purpose — those
 * surfaces stay clutter-free by design. This belongs on calm marketing /
 * desk surfaces (the home footer).
 */

const DEEPSPACE_URL =
  'https://deep.space/?utm_source=reddit&utm_medium=social&utm_campaign=launch&utm_content=open-source-post'

/** Concave 4-point sparkle — reads as both a star ("space") and a spark. */
function SparkMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
      <path d="M12 0 C 12.5 6.5 17.5 11.5 24 12 C 17.5 12.5 12.5 17.5 12 24 C 11.5 17.5 6.5 12.5 0 12 C 6.5 11.5 11.5 6.5 12 0 Z" />
    </svg>
  )
}

export function MadeWithDeepSpace({ className = '' }: { className?: string }) {
  return (
    <a
      href={DEEPSPACE_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={
        'group inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 ' +
        'text-[12.5px] font-medium text-muted-foreground shadow-[0_1px_0_rgba(0,0,0,0.04)] ' +
        'transition-all duration-200 hover:-translate-y-px hover:border-foreground/30 hover:text-foreground ' +
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ' +
        'focus-visible:ring-offset-background ' +
        className
      }
    >
      <SparkMark className="h-3.5 w-3.5 text-foreground/35 transition-colors duration-200 group-hover:text-primary" />
      <span className="tracking-tight">
        Made with{' '}
        <span className="font-display font-semibold text-foreground">DeepSpace</span>
      </span>
    </a>
  )
}

export default MadeWithDeepSpace
