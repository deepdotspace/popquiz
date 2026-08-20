/**
 * Regression tests for the `/api/files/*` proxy.
 *
 * The bug: the proxy demanded a JWT on EVERY method, so a browser fetching an
 * uploaded `<img>` / `<video>` / `<audio>` src — which never carries an
 * Authorization header — got 401 and the media rendered broken.
 *
 * The risk in fixing it: `scope: 'self'` files must stay private, and no
 * caller may spoof an identity. Both halves are asserted here.
 *
 * These run in plain vitest against `app.fetch()` with a stubbed
 * PLATFORM_WORKER binding — no dev server, no workerd. What that buys is the
 * real Hono routing, the real auth gate, and the real header rewriting; what
 * it does not cover is the platform worker's own prefix enforcement, which
 * lives in the SDK and has its own tests.
 */

import { describe, expect, it, beforeAll } from 'vitest'
import { SignJWT, exportSPKI, generateKeyPair } from 'jose'
import { isPublicFileRead, fileKeyFromPath } from './public-file-reads.js'
import app from '../../worker.js'
import type { Env } from '../../worker.js'

const APP_KEY = 'apps/res_abc/1750000000000-k3j4h5g6f-photo.png'
const USER_KEY = 'apps/res_abc/users/user_victim/private.png'

function publicRead(path: string, method = 'GET'): boolean {
  const url = new URL(path, 'https://popquiz.app.space')
  return isPublicFileRead(method, url.pathname, url.searchParams)
}

describe('isPublicFileRead', () => {
  it('admits the keyed app-scope GET that an <img>/<video>/<audio> src makes', () => {
    expect(publicRead(`/api/files/${APP_KEY}?scope=app`)).toBe(true)
  })

  it('refuses scope=self, and refuses a missing scope (which defaults to self)', () => {
    expect(publicRead(`/api/files/${APP_KEY}?scope=self`)).toBe(false)
    expect(publicRead(`/api/files/${APP_KEY}`)).toBe(false)
  })

  it('refuses the list route, which would enumerate every user key', () => {
    // `?prefix=users/` on this route lists other people's keys.
    expect(publicRead('/api/files/?scope=app&prefix=users/')).toBe(false)
    expect(publicRead('/api/files/?scope=app')).toBe(false)
  })

  it('refuses a user-namespaced key even when it claims scope=app', () => {
    // The platform's app-scope guard is `key.startsWith('apps/<id>/')`, and
    // user keys are strict descendants of that prefix — so this one request
    // shape is the whole reason the `users/` rule exists.
    expect(publicRead(`/api/files/${USER_KEY}?scope=app`)).toBe(false)
  })

  it('refuses a user-namespaced key hidden behind percent-encoding', () => {
    // Both spellings survive URL parsing untouched and only become the
    // `users` segment once decoded — which is why the check decodes first.
    expect(publicRead('/api/files/apps/res_abc/%75sers/user_victim/private.png?scope=app')).toBe(
      false,
    )
    expect(publicRead('/api/files/apps/res_abc/%2Fusers%2Fuser_victim/private.png?scope=app')).toBe(
      false,
    )
  })

  it('refuses dot segments in a raw, unparsed path', () => {
    // WHATWG URL parsing collapses `..` / `.` / `%2e%2e` out of `pathname`
    // before a real request reaches this, so the guard only matters for a
    // caller that hands over an unparsed string. Asserted directly, not
    // through `new URL`, because `new URL` would normalize the input away.
    const q = new URLSearchParams('scope=app')
    expect(isPublicFileRead('GET', '/api/files/apps/res_abc/x/../users/v/p.png', q)).toBe(false)
    expect(isPublicFileRead('GET', '/api/files/apps/res_abc/./photo.png', q)).toBe(false)
  })

  it('refuses every method that mutates', () => {
    for (const method of ['POST', 'PUT', 'DELETE', 'PATCH', 'HEAD']) {
      expect(publicRead(`/api/files/${APP_KEY}?scope=app`, method), method).toBe(false)
    }
  })

  it('decodes the key the same way the platform does', () => {
    expect(fileKeyFromPath('/api/files/apps/res_abc/my%20photo.png')).toBe(
      'apps/res_abc/my photo.png',
    )
    expect(fileKeyFromPath('/api/files')).toBe('')
    expect(fileKeyFromPath('/api/records/x')).toBe(null)
    expect(fileKeyFromPath('/api/files/%E0%A4%A')).toBe(null)
  })
})

describe('/api/files/* proxy', () => {
  let env: Env
  let forwarded: Request[]
  let token: string

  beforeAll(async () => {
    const { publicKey, privateKey } = await generateKeyPair('ES256', { extractable: true })
    const issuer = 'https://auth.deep.space'
    token = await new SignJWT({})
      .setProtectedHeader({ alg: 'ES256' })
      .setSubject('user_real')
      .setIssuer(issuer)
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(privateKey)

    forwarded = []
    env = {
      APP_IDENTITY_TOKEN: 'identity-token',
      DEEPSPACE_APP_ID: 'app_01TEST',
      AUTH_JWT_PUBLIC_KEY: await exportSPKI(publicKey),
      AUTH_JWT_ISSUER: issuer,
      PLATFORM_WORKER: {
        fetch: async (req: Request) => {
          forwarded.push(req)
          return new Response('binary-bytes', {
            status: 200,
            headers: { 'content-type': 'image/png' },
          })
        },
      },
    } as unknown as Env
  })

  const call = (path: string, init?: RequestInit) => {
    forwarded = []
    return app.fetch(new Request(`https://popquiz.app.space${path}`, init), env)
  }

  it('serves an app-scope media read with no Authorization header', async () => {
    const res = await call(`/api/files/${APP_KEY}?scope=app`)
    expect(res.status).toBe(200)
    expect(forwarded).toHaveLength(1)
    expect(new URL(forwarded[0].url).pathname).toBe(`/internal/files/${APP_KEY}`)
  })

  // The same path serves all three media kinds — MediaEditor uploads image,
  // video and audio through one `useR2Files({ scope: 'app' })` and renders
  // them as <img>/<video>/<audio> srcs.
  it.each([
    ['image', 'apps/res_abc/1-a-photo.png'],
    ['video', 'apps/res_abc/2-b-clip.mp4'],
    ['audio', 'apps/res_abc/3-c-track.mp3'],
  ])('serves %s media anonymously', async (_kind, key) => {
    expect((await call(`/api/files/${key}?scope=app`)).status).toBe(200)
  })

  it('sends NO x-user-id upstream for an anonymous read', async () => {
    await call(`/api/files/${APP_KEY}?scope=app`)
    // This is what makes the platform resolve scope=self to an error rather
    // than to somebody's prefix.
    expect(forwarded[0].headers.get('x-user-id')).toBe(null)
    expect(forwarded[0].headers.get('x-app-identity-token')).toBe('identity-token')
  })

  it('strips a caller-supplied x-user-id on an anonymous read', async () => {
    await call(`/api/files/${APP_KEY}?scope=app`, {
      headers: { 'x-user-id': 'user_victim' },
    })
    expect(forwarded[0].headers.get('x-user-id')).toBe(null)
  })

  it('overrides a caller-supplied x-user-id with the JWT subject', async () => {
    await call(`/api/files/${APP_KEY}?scope=app`, {
      headers: { Authorization: `Bearer ${token}`, 'x-user-id': 'user_victim' },
    })
    expect(forwarded[0].headers.get('x-user-id')).toBe('user_real')
  })

  it('still 401s an anonymous scope=self read, without calling the platform', async () => {
    const res = await call(`/api/files/${APP_KEY}?scope=self`)
    expect(res.status).toBe(401)
    expect(forwarded).toHaveLength(0)
  })

  it('still 401s an anonymous read of a user-namespaced key claiming scope=app', async () => {
    const res = await call(`/api/files/${USER_KEY}?scope=app`)
    expect(res.status).toBe(401)
    expect(forwarded).toHaveLength(0)
  })

  it('still 401s anonymous listing', async () => {
    const res = await call('/api/files/?scope=app&prefix=users/')
    expect(res.status).toBe(401)
    expect(forwarded).toHaveLength(0)
  })

  it.each([
    ['upload', '/api/files/upload?scope=app', 'POST'],
    ['multipart init', '/api/files/multipart?scope=app', 'POST'],
    ['delete', `/api/files/${APP_KEY}?scope=app`, 'DELETE'],
  ])('still 401s anonymous %s', async (_label, path, method) => {
    const res = await call(path, { method })
    expect(res.status).toBe(401)
    expect(forwarded).toHaveLength(0)
  })

  it('lets an authenticated caller reach the platform for a scope=self read', async () => {
    const res = await call(`/api/files/apps/res_abc/users/user_real/note.txt?scope=self`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.status).toBe(200)
    expect(forwarded[0].headers.get('x-user-id')).toBe('user_real')
  })

  it('treats an invalid JWT as anonymous rather than as its claimed subject', async () => {
    const res = await call(`/api/files/${APP_KEY}?scope=self`, {
      headers: { Authorization: 'Bearer not-a-jwt' },
    })
    expect(res.status).toBe(401)
    expect(forwarded).toHaveLength(0)
  })
})
