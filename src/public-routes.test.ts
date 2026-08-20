/**
 * Route placement is the whole auth model here: `src/pages/(protected)/`
 * renders inside the SDK's <AuthGate>, everything else renders for anyone.
 * `(protected)` is a Generouted route group, so the parentheses never reach
 * the URL — a page can be moved in or out of the gate without any visible
 * sign that its access changed. These assertions are the missing sign.
 */

import { describe, it, expect } from 'vitest'
import protectedLayoutSource from './pages/(protected)/_layout.tsx?raw'

// The same module graph the router is generated from.
const pageFiles = new Set(Object.keys(import.meta.glob('./pages/**/*.tsx')))

function hasPage(path: string) {
  return pageFiles.has(`./pages/${path}`)
}

describe('public routes', () => {
  it('serves the join flow outside the auth gate', () => {
    // Players arrive by QR code or by typing a PIN. Moving either of these
    // back under (protected)/ puts a login screen in front of that.
    expect(hasPage('play/index.tsx')).toBe(true)
    expect(hasPage('play/[pin].tsx')).toBe(true)
    expect([...pageFiles].filter((p) => p.startsWith('./pages/(protected)/play'))).toEqual([])
  })

  it('serves the landing page outside the auth gate', () => {
    expect(hasPage('home.tsx')).toBe(true)
  })
})

describe('gated routes', () => {
  it('keeps the gate itself in place', () => {
    expect(protectedLayoutSource).toContain('AuthGate')
  })

  it('keeps every authoring surface behind it', () => {
    // Creating quizzes, hosting a game, reading reports and changing settings
    // all act on the signed-in user's own records.
    for (const page of [
      '(protected)/quizzes/index.tsx',
      '(protected)/quizzes/[id]/edit.tsx',
      '(protected)/host/[gameId].tsx',
      '(protected)/reports/index.tsx',
      '(protected)/reports/[gameId].tsx',
      '(protected)/settings.tsx',
    ]) {
      expect(hasPage(page), `${page} must stay gated`).toBe(true)
    }
  })
})
