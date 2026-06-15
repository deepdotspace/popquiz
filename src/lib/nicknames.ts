/**
 * Random adjective + noun nickname generator. Local — no SDK feature for it.
 *
 * 30 adjectives × 30 nouns = 900 combinations, well above the typical
 * ~800. Mostly playful, broadly classroom-safe.
 */

const ADJECTIVES = [
  'Brave', 'Clever', 'Cosmic', 'Daring', 'Eager', 'Electric', 'Fancy', 'Fierce',
  'Gentle', 'Glowing', 'Happy', 'Jolly', 'Kindly', 'Lucky', 'Mighty', 'Nimble',
  'Plucky', 'Quiet', 'Rapid', 'Sharp', 'Snazzy', 'Sneaky', 'Spunky', 'Stellar',
  'Sunny', 'Swift', 'Witty', 'Zany', 'Zealous', 'Zippy',
]

const NOUNS = [
  'Otter', 'Tiger', 'Falcon', 'Panda', 'Llama', 'Walrus', 'Robot', 'Comet',
  'Pixel', 'Pirate', 'Wizard', 'Ninja', 'Yeti', 'Phoenix', 'Dragon', 'Sloth',
  'Penguin', 'Ferret', 'Mango', 'Cactus', 'Muffin', 'Banjo', 'Pickle', 'Noodle',
  'Cookie', 'Doodle', 'Quokka', 'Narwhal', 'Goblin', 'Gizmo',
]

export function randomNickname(): string {
  const a = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]
  const n = NOUNS[Math.floor(Math.random() * NOUNS.length)]
  return `${a}${n}`
}

export function nicknameOptions(count = 3): string[] {
  const out = new Set<string>()
  while (out.size < count) out.add(randomNickname())
  return Array.from(out)
}
