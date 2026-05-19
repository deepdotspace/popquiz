/**
 * Tiny profanity filter. Rejects nicknames matching obvious slurs / vulgar
 * words. Not exhaustive — a real product would use `bad-words` or similar.
 *
 * Match is substring-insensitive after normalization (lowercase, strip
 * non-alphanumerics) so "h*ll0" still gets caught.
 */

// Obvious bad words in english. Keep short & PG to avoid checking-in slurs;
// extend in production with a vetted library.
const BANNED = [
  'fuck', 'shit', 'asshole', 'bitch', 'cunt', 'dick', 'pussy', 'slut',
  'whore', 'bastard', 'damn', 'hell', 'piss', 'crap', 'fag', 'retard',
  'nigger', 'nigga', 'spic', 'kike', 'chink',
]

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]/g, '')
}

export function isProfane(input: string): boolean {
  const norm = normalize(input)
  return BANNED.some((bad) => norm.includes(bad))
}

export function validateNickname(input: string): { ok: true } | { ok: false; reason: string } {
  const trimmed = input.trim()
  if (trimmed.length < 2) return { ok: false, reason: 'Nickname must be at least 2 characters.' }
  if (trimmed.length > 20) return { ok: false, reason: 'Nickname must be 20 characters or less.' }
  if (isProfane(trimmed)) return { ok: false, reason: 'Please pick a different nickname.' }
  return { ok: true }
}
