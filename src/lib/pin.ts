/**
 * 6-digit join PIN. Caller must check uniqueness against active games and
 * retry on collision (probability is low but real).
 */
export function generatePin(): string {
  return String(Math.floor(100_000 + Math.random() * 900_000))
}

export function isValidPin(s: unknown): s is string {
  return typeof s === 'string' && /^\d{6}$/.test(s)
}
