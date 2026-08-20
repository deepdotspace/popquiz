/**
 * Guest identity for signed-out players.
 *
 * Joining a game needs no account, but the server still needs a stable id per
 * player so `joinGame` can hand back the same row on a refresh and
 * `submitAnswer` can tell whether the caller owns the slot it is scoring.
 *
 * The browser keeps a random 256-bit *secret*. The server never stores it: it
 * stores `guest-<sha256(secret)>` in `players.userId`. That column is world-
 * readable — every player renders the lobby and the leaderboard — so the row
 * must not contain anything that lets one player act as another. A digest is
 * safe to publish; the secret behind it is not derivable from it.
 *
 * Both halves live here so the contract has one definition: the browser mints
 * and holds the secret, the worker turns it into an id. Signed-in players use
 * neither — the worker prefers a verified JWT, so they stay attributed to
 * their real account.
 */

const GUEST_SECRET_KEY = 'popquiz:guest-secret'

/** Domain separator, so this digest can never collide with another use of the same secret. */
const GUEST_ID_DOMAIN = 'popquiz-guest:'

const SECRET_RE = /^[0-9a-f]{64}$/

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

function randomSecret(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return toHex(bytes)
}

// ---------------------------------------------------------------------------
// Browser half
// ---------------------------------------------------------------------------

/** Survives a private-mode / storage-disabled browser, for the current tab only. */
let memorySecret: string | null = null

/**
 * This browser's guest secret, minted on first use. Sent only to this app's
 * own `/api/actions/*` endpoint, and never written into a record.
 */
export function getGuestSecret(): string {
  try {
    const existing = localStorage.getItem(GUEST_SECRET_KEY)
    if (existing && SECRET_RE.test(existing)) return existing
    const minted = randomSecret()
    localStorage.setItem(GUEST_SECRET_KEY, minted)
    return minted
  } catch {
    // Storage blocked: the player can still finish this tab's session, they
    // just won't be recognised as the same guest after a reload.
    if (!memorySecret) memorySecret = randomSecret()
    return memorySecret
  }
}

// ---------------------------------------------------------------------------
// Worker half
// ---------------------------------------------------------------------------

/**
 * The stable player id for a guest holding `secret`, or null if that isn't a
 * well-formed secret — a missing or junk header is simply unauthenticated,
 * never a partly-trusted identity.
 */
export async function guestUserId(secret: string): Promise<string | null> {
  if (!SECRET_RE.test(secret)) return null
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(GUEST_ID_DOMAIN + secret),
  )
  return `guest-${toHex(new Uint8Array(digest))}`
}
