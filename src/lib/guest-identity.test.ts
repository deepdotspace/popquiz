import { describe, it, expect, afterEach } from 'vitest'
import { getGuestSecret, guestUserId } from './guest-identity'

const SECRET_A = 'a'.repeat(64)
const SECRET_B = 'b'.repeat(64)

function installLocalStorage(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial))
  const stub = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  }
  Object.defineProperty(globalThis, 'localStorage', {
    value: stub,
    configurable: true,
    writable: true,
  })
  return store
}

function removeLocalStorage() {
  Reflect.deleteProperty(globalThis as Record<string, unknown>, 'localStorage')
}

describe('guestUserId', () => {
  it('rejects anything that is not a well-formed secret', async () => {
    // A missing or junk header must be *unauthenticated*, never a
    // partly-trusted identity the worker would go on to stamp onto a row.
    for (const bad of ['', 'not-hex', 'A'.repeat(64), 'a'.repeat(63), 'a'.repeat(65), ' ' + SECRET_A]) {
      expect(await guestUserId(bad)).toBeNull()
    }
  })

  it('derives a stable prefixed id from a valid secret', async () => {
    const id = await guestUserId(SECRET_A)
    expect(id).toMatch(/^guest-[0-9a-f]{64}$/)
    expect(await guestUserId(SECRET_A)).toBe(id)
  })

  it('never leaks the secret into the id', async () => {
    // `players.userId` holds this value and is world-readable, so a player who
    // reads another player's row must not learn anything they could replay.
    const id = await guestUserId(SECRET_A)
    expect(id).not.toContain(SECRET_A)
  })

  it('separates guests', async () => {
    expect(await guestUserId(SECRET_A)).not.toBe(await guestUserId(SECRET_B))
  })
})

describe('getGuestSecret', () => {
  afterEach(() => {
    removeLocalStorage()
  })

  it('mints a secret guestUserId accepts, and persists it', async () => {
    const store = installLocalStorage()
    const secret = getGuestSecret()

    expect(await guestUserId(secret)).not.toBeNull()
    expect(store.get('popquiz:guest-secret')).toBe(secret)
    expect(getGuestSecret()).toBe(secret)
  })

  it('reuses a secret already in storage', () => {
    installLocalStorage({ 'popquiz:guest-secret': SECRET_A })
    expect(getGuestSecret()).toBe(SECRET_A)
  })

  it('replaces a corrupted stored value rather than sending it', async () => {
    const store = installLocalStorage({ 'popquiz:guest-secret': 'tampered' })
    const secret = getGuestSecret()

    expect(secret).not.toBe('tampered')
    expect(await guestUserId(secret)).not.toBeNull()
    expect(store.get('popquiz:guest-secret')).toBe(secret)
  })

  it('still returns a usable secret when storage is unavailable', async () => {
    // Private mode / storage disabled: the player finishes this tab's session
    // rather than being locked out of the game.
    removeLocalStorage()
    const secret = getGuestSecret()

    expect(await guestUserId(secret)).not.toBeNull()
    expect(getGuestSecret()).toBe(secret)
  })
})
