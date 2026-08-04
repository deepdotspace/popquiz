/**
 * App Worker — Hono-based Cloudflare Worker for DeepSpace apps.
 *
 * Each app owns its RecordRoom DOs. Schemas are baked in at deploy time.
 *
 * Handles:
 *   - WebSocket → app's own RecordRoom DO (real-time data)
 *   - Auth proxy → auth-worker (same-origin cookies)
 *   - Integration proxy → api-worker (LLM, search, etc.)
 *   - AI chat (Vercel AI SDK + DeepSpace proxy)
 *   - Server actions (app-defined, bypass user RBAC)
 *   - Scoped R2 file storage
 *   - Scheduled cron tasks (CronRoom Durable Object)
 *   - Static asset serving with SPA fallback
 */

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import {
  verifyJwt,
  apiWorkerFetch,
  platformWorkerFetch,
  authWorkerFetch,
} from 'deepspace/worker'
import type { JwtVerifierConfig, VerifyResult } from 'deepspace/worker'
import {
  RecordRoom,
  YjsRoom,
  CanvasRoom,
  PresenceRoom,
  CronRoom,
} from 'deepspace/worker'
import type { ActionTools, ActionResult, DOManifest, DOBindings } from 'deepspace/worker'
import { actions } from './src/actions/index.js'
import { tasks as cronTasks, runTask as runCronTask } from './src/cron.js'
import { schemas } from './src/schemas.js'
import { integrations } from './src/integrations.js'
import { registerAiChatRoutes } from './src/ai/chat-routes.js'
import { registerAiQuizRoutes } from './src/ai/quiz-routes.js'

// =============================================================================
// DO Manifest — declares all Durable Objects for dynamic deploy bindings
// =============================================================================

export const __DO_MANIFEST__ = [
  { binding: 'RECORD_ROOMS', className: 'AppRecordRoom', sqlite: true },
  { binding: 'YJS_ROOMS', className: 'AppYjsRoom', sqlite: true },
  { binding: 'CANVAS_ROOMS', className: 'AppCanvasRoom', sqlite: true },
  { binding: 'PRESENCE_ROOMS', className: 'AppPresenceRoom', sqlite: true },
  { binding: 'CRON_ROOMS', className: 'AppCronRoom', sqlite: true },
] as const satisfies DOManifest

// =============================================================================
// Durable Objects — extend to customize behavior
// =============================================================================

export class AppRecordRoom extends RecordRoom {
  constructor(state: DurableObjectState, env: Env) {
    super(state, env, schemas, { ownerUserId: env.OWNER_USER_ID })
  }
}

export class AppYjsRoom extends YjsRoom {}
export class AppCanvasRoom extends CanvasRoom {}
export class AppPresenceRoom extends PresenceRoom {}

/**
 * AppCronRoom — runs scheduled tasks defined in src/cron.ts.
 *
 * Tasks are configured at construction time. The DO alarm fires at the
 * next interval / cron-expression match, calls `onTask(name)`, and
 * records the execution in its `cron_history` table. Admin clients can
 * watch via the `useCronMonitor('app:<APP_NAME>')` hook.
 */
export class AppCronRoom extends CronRoom {
  // Re-declare the base class's `env` with our concrete typed Env so onTask()
  // can use it without casting. `declare` avoids TS2612 (overwrite warning)
  // and TS2415 (privacy mismatch with the base property).
  declare protected readonly env: Env

  constructor(state: DurableObjectState, env: Env) {
    super(state, env, { tasks: cronTasks })
  }

  protected async onTask(taskName: string): Promise<void> {
    await runCronTask(taskName, this.env)
  }
}

// =============================================================================
// Types
// =============================================================================

export interface Env extends DOBindings<typeof __DO_MANIFEST__> {
  // Index signature lets our concrete `Env` satisfy `CronRoom`'s base
  // env type and ActionTools' Record<string, unknown> param without
  // forcing every field to be `unknown` here.
  [key: string]: unknown
  ASSETS: Fetcher
  /**
   * Upstream platform-worker. In production this is a [[services]] binding;
   * in `deepspace dev` the binding is absent and the helper falls back to
   * `PLATFORM_WORKER_URL` (written into .dev.vars by the CLI).
   */
  PLATFORM_WORKER?: Fetcher
  PLATFORM_WORKER_URL?: string
  APP_IDENTITY_TOKEN: string
  /**
   * Upstream api-worker. Same pattern as PLATFORM_WORKER above —
   * binding in prod, URL fallback in dev.
   */
  API_WORKER?: Fetcher
  API_WORKER_URL?: string
  AUTH_JWT_PUBLIC_KEY: string
  AUTH_JWT_ISSUER: string
  AUTH_WORKER_URL: string
  APP_NAME: string
  DEEPSPACE_APP_ID: string
  OWNER_USER_ID: string
  /**
   * Long-lived JWT minted for the app owner at deploy time. Server-side
   * code (actions, cron, AI helpers) uses this to authenticate to the
   * api-worker for developer-billed calls — the owner is billed because
   * they are the JWT subject.
   */
  APP_OWNER_JWT: string
  INTERNAL_STORAGE_HMAC_SECRET: string
  /**
   * When set to "true", the app worker exposes /api/debug/* (set-role,
   * sql, query, records, status) by forwarding to the RecordRoom DO's
   * debug handler. Tests need this for role elevation and state cleanup.
   *
   * The CLI writes this to .dev.vars on `deepspace dev`/`deepspace test`
   * but never to production secrets, so deployed apps don't expose
   * debug routes by default.
   */
  ALLOW_DEBUG_ROUTES?: string
}

export type AppContext = { Bindings: Env }

// =============================================================================
// App
// =============================================================================

const app = new Hono<AppContext>()
app.use('/api/*', cors())

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

function jwtConfig(env: Env): JwtVerifierConfig {
  return { publicKey: env.AUTH_JWT_PUBLIC_KEY, issuer: env.AUTH_JWT_ISSUER }
}

async function resolveAuth(req: Request, env: Env): Promise<VerifyResult | null> {
  const header = req.headers.get('Authorization')
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return null
  return (await verifyJwt(jwtConfig(env), token)).result
}

// ---------------------------------------------------------------------------
// Social OAuth redirect + code exchange
// ---------------------------------------------------------------------------

app.get('/api/auth/social-redirect', (c) => {
  const provider = c.req.query('provider')
  if (!provider) return c.json({ error: 'Missing provider' }, 400)

  const appOrigin = new URL(c.req.url).origin
  const authOrigin = new URL(c.env.AUTH_WORKER_URL).origin

  return c.redirect(
    `${authOrigin}/login/social?provider=${encodeURIComponent(provider)}&returnTo=${encodeURIComponent(appOrigin)}`,
  )
})

app.get('/api/auth/oauth-complete', async (c) => {
  const code = c.req.query('code')
  const appOrigin = new URL(c.req.url).origin

  if (!code) return c.redirect(appOrigin)

  const res = await authWorkerFetch(c.env, '/api/auth/exchange-code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  })

  if (!res.ok) return c.redirect(appOrigin)
  const data = (await res.json()) as { sessionToken?: string }
  if (!data.sessionToken) return c.redirect(appOrigin)
  const sessionToken = data.sessionToken

  return new Response(null, {
    status: 302,
    headers: {
      Location: appOrigin,
      'Set-Cookie': `__Secure-better-auth.session_token=${encodeURIComponent(sessionToken)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`,
    },
  })
})

// ---------------------------------------------------------------------------
app.all('/api/auth/sign-out', async (c) => {
  try {
    await authWorkerFetch(c.env, '/api/auth/sign-out', {
      method: c.req.method,
      headers: c.req.raw.headers,
      body: c.req.method !== 'GET' && c.req.method !== 'HEAD' ? c.req.raw.body : undefined,
    })
  } catch {
    // Always expire the app-scoped cookie, even if auth-worker is unavailable.
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': '__Secure-better-auth.session_token=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0',
    },
  })
})

// ---------------------------------------------------------------------------
// Auth proxy → auth-worker (same-origin cookies)
// ---------------------------------------------------------------------------

app.all('/api/auth/*', async (c) => {
  const url = new URL(c.req.url)
  const res = await authWorkerFetch(c.env, url.pathname + url.search, {
    method: c.req.method,
    headers: c.req.raw.headers,
    body: c.req.method !== 'GET' && c.req.method !== 'HEAD' ? c.req.raw.body : undefined,
  })
  const headers = new Headers(res.headers)
  const setCookie = headers.get('set-cookie')
  if (setCookie) {
    headers.set('set-cookie', setCookie.replace(/;\s*Domain=[^;]*/gi, ''))
  }
  return new Response(res.body, { status: res.status, headers })
})

// ---------------------------------------------------------------------------
// Debug proxy → app's RecordRoom DO
//
// Forwards /api/debug/* (set-role, sql, query, records, user-role, status)
// to the DO's debug handler. The DO ships these endpoints unconditionally,
// so we gate the proxy on env.ALLOW_DEBUG_ROUTES === "true". The CLI
// writes that env var to .dev.vars on `deepspace dev`/`deepspace test`,
// never to deploy secrets — so production apps return 404 here.
// ---------------------------------------------------------------------------

app.all('/api/debug/*', async (c) => {
  if (c.env.ALLOW_DEBUG_ROUTES !== 'true') {
    return c.notFound()
  }
  const stub = c.env.RECORD_ROOMS.get(
    c.env.RECORD_ROOMS.idFromName(`app:${c.env.APP_NAME}`),
  )
  // Forward verbatim, preserving method, headers, body, and the full URL
  // (the DO's debug handler dispatches on url.pathname).
  return stub.fetch(c.req.raw)
})

// ---------------------------------------------------------------------------
// Integrations proxy → api-worker
// ---------------------------------------------------------------------------

app.get('/api/integrations', async (c) => {
  try {
    const res = await apiWorkerFetch(c.env, '/api/integrations')
    return new Response(res.body, { status: res.status, headers: res.headers })
  } catch {
    return c.json({ error: 'Failed to fetch integration catalog' }, 502)
  }
})

// OAuth: per-user connection status. Always user-billed — must forward caller's JWT.
app.get('/api/integrations/status', async (c) => {
  const auth = await resolveAuth(c.req.raw, c.env)
  if (!auth) return c.json({ error: 'Sign in required' }, 401)
  const token = c.req.header('Authorization')?.slice(7)
  try {
    const res = await apiWorkerFetch(c.env, '/api/integrations/status', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    return new Response(res.body, { status: res.status, headers: res.headers })
  } catch {
    return c.json({ error: 'Status proxy failed' }, 502)
  }
})

// OAuth: disconnect a provider for the calling user. Always user-billed.
app.delete('/api/integrations/oauth/:provider/disconnect', async (c) => {
  const auth = await resolveAuth(c.req.raw, c.env)
  if (!auth) return c.json({ error: 'Sign in required' }, 401)
  const token = c.req.header('Authorization')?.slice(7)
  const provider = c.req.param('provider')
  try {
    const res = await apiWorkerFetch(
      c.env,
      `/api/integrations/oauth/${encodeURIComponent(provider)}/disconnect`,
      {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      },
    )
    return new Response(res.body, { status: res.status, headers: res.headers })
  } catch {
    return c.json({ error: 'Disconnect proxy failed' }, 502)
  }
})

app.all('/api/integrations/:name/:endpoint', async (c) => {
  const integrationName = c.req.param('name')
  const billingMode = integrations[integrationName]?.billing ?? 'developer'

  const auth = await resolveAuth(c.req.raw, c.env)
  if (!auth && billingMode === 'user') {
    return c.json({ error: 'Sign in required for this integration' }, 401)
  }

  const target = `/api/integrations/${integrationName}/${c.req.param('endpoint')}`

  const headers: Record<string, string> = {
    'Content-Type': c.req.header('Content-Type') ?? 'application/json',
  }

  // Pick the JWT whose subject is the user we want billed:
  //   - developer-billed → the app owner (via APP_OWNER_JWT)
  //   - user-billed      → the caller (forward their Bearer token)
  // The api-worker bills the JWT subject; it does not accept any
  // client-supplied billing override.
  if (billingMode === 'developer') {
    headers['Authorization'] = `Bearer ${c.env.APP_OWNER_JWT}`
  } else {
    const token = c.req.header('Authorization')?.slice(7)
    if (token) headers['Authorization'] = `Bearer ${token}`
  }

  const hasBody = c.req.method !== 'GET' && c.req.method !== 'HEAD'
  const body = hasBody ? await c.req.text() : undefined

  try {
    const res = await apiWorkerFetch(c.env, target, {
      method: c.req.method,
      headers,
      body,
    })
    return new Response(res.body, { status: res.status, headers: res.headers })
  } catch {
    return c.json({ error: 'Integration proxy failed' }, 502)
  }
})

// ---------------------------------------------------------------------------
// WebSocket routes
// ---------------------------------------------------------------------------

function wsRoute(
  doNamespace: (env: Env) => DurableObjectNamespace,
  extraParams?: (auth: VerifyResult) => Record<string, string>,
) {
  return async (c: any) => {
    const id = c.req.param('roomId') ?? c.req.param('docId') ?? c.req.param('scopeId')
    const url = new URL(c.req.url)
    const token = url.searchParams.get('token')
    const auth = token ? (await verifyJwt(jwtConfig(c.env), token)).result : null

    const doUrl = new URL(c.req.url)
    if (auth) {
      doUrl.searchParams.set('userId', auth.userId)
      if (extraParams) {
        for (const [k, v] of Object.entries(extraParams(auth))) {
          doUrl.searchParams.set(k, v)
        }
      }
    }
    doUrl.searchParams.delete('token')

    const ns = doNamespace(c.env)
    const stub = ns.get(ns.idFromName(id))
    return stub.fetch(new Request(doUrl.toString(), c.req.raw))
  }
}

app.get('/ws/:roomId', wsRoute((env) => env.RECORD_ROOMS))

app.get('/ws/yjs/:docId', wsRoute((env) => env.YJS_ROOMS, () => ({ role: 'member' })))

app.get('/ws/canvas/:docId', wsRoute((env) => env.CANVAS_ROOMS, () => ({ role: 'member' })))


app.get('/ws/presence/:scopeId', wsRoute(
  (env) => env.PRESENCE_ROOMS,
  (auth) => ({
    ...(auth.claims.name ? { userName: auth.claims.name } : {}),
    ...(auth.claims.email ? { userEmail: auth.claims.email } : {}),
    ...(auth.claims.image ? { userImageUrl: auth.claims.image } : {}),
  }),
))

app.get('/ws/cron/:roomId', wsRoute((env) => env.CRON_ROOMS))

// ---------------------------------------------------------------------------
// Server actions
// ---------------------------------------------------------------------------

app.post('/api/actions/:name', async (c) => {
  const auth = await resolveAuth(c.req.raw, c.env)
  if (!auth) return c.json({ error: 'Unauthorized' }, 401)
  const name = c.req.param('name')
  const action = actions[name]
  if (!action) return c.json({ error: 'Action not found' }, 404)
  const params = await c.req.json<Record<string, unknown>>()
  const callerJwt = c.req.header('Authorization')!.slice(7)
  const tools = createActionTools(c.env, auth.userId, callerJwt)
  const result = await action({ userId: auth.userId, params, tools, env: c.env, callerJwt })
  return c.json(result as unknown as Record<string, unknown>)
})

// ---------------------------------------------------------------------------
// AI chat — multi-turn tool-use via Vercel AI SDK + DeepSpace proxy
// ---------------------------------------------------------------------------

// Routes implementation lives in `src/ai/chat-routes.ts` to keep this file
// focused on app-level wiring. `resolveAuth` is passed in to avoid a runtime
// circular import (chat-routes imports `Env`/`AppContext` as types only).
registerAiChatRoutes(app, resolveAuth)
registerAiQuizRoutes(app, resolveAuth)

// ---------------------------------------------------------------------------
// Scoped R2 files → platform-worker
// ---------------------------------------------------------------------------

app.all('/api/files/*', async (c) => {
  const auth = await resolveAuth(c.req.raw, c.env)
  if (!auth) return c.json({ error: 'Unauthorized' }, 401)

  const url = new URL(c.req.url)
  const platformUrl = new URL(c.req.url)
  platformUrl.pathname = url.pathname.replace('/api/files', '/internal/files')

  const headers = new Headers(c.req.raw.headers)
  // Strip any caller-supplied identity; only the JWT-derived userId may
  // reach the platform-worker. Otherwise a client could spoof
  // `x-user-id: <victim>` and read another user's scope=self files.
  headers.delete('x-user-id')
  headers.set('x-app-identity-token', c.env.APP_IDENTITY_TOKEN)
  headers.set('x-app-id', c.env.DEEPSPACE_APP_ID)
  headers.set('x-user-id', auth.userId)

  const resp = await platformWorkerFetch(
    c.env,
    new Request(platformUrl.toString(), {
      method: c.req.method,
      headers,
      body: c.req.raw.body,
    }),
  )

  // Rewrite URLs in JSON responses to use the app's origin
  const contentType = resp.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    const body = (await resp.json()) as Record<string, unknown>
    const rewriteUrl = (u: string) => u.replace(/^https?:\/\/[^/]+/, url.origin)
    if (typeof body.url === 'string') body.url = rewriteUrl(body.url)
    if (Array.isArray(body.files)) {
      for (const f of body.files as Array<Record<string, unknown>>) {
        if (typeof f.url === 'string') f.url = rewriteUrl(f.url)
      }
    }
    return c.json(body, resp.status as any)
  }

  return new Response(resp.body, { status: resp.status, headers: resp.headers })
})

// ---------------------------------------------------------------------------
// Reports CSV export — owner-only download of leaderboard + per-question stats
// ---------------------------------------------------------------------------

app.get('/api/reports/:gameId/csv', async (c) => {
  const auth = await resolveAuth(c.req.raw, c.env)
  if (!auth) return c.json({ error: 'Unauthorized' }, 401)
  const gameId = c.req.param('gameId')

  const stub = c.env.RECORD_ROOMS.get(
    c.env.RECORD_ROOMS.idFromName(`app:${c.env.APP_NAME}`),
  )

  try {

  async function doQuery(
    collection: string,
    params: Record<string, unknown>,
  ): Promise<Array<{ recordId: string; data: any }>> {
    const res = await stub.fetch(new Request('https://internal/api/tools/execute', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': auth!.userId,
        'X-App-Action': 'true',
      },
      body: JSON.stringify({ tool: 'records.query', params: { collection, ...params } }),
    }))
    if (!res.ok) throw new Error(`records.query failed (${res.status})`)
    const out = (await res.json()) as {
      success: boolean
      error?: string
      data?: { records?: Array<{ recordId: string; data: any }> }
    }
    if (!out.success) throw new Error(out.error ?? 'records.query failed')
    return out.data?.records ?? []
  }

  async function doGet(
    collection: string,
    recordId: string,
  ): Promise<{ recordId: string; data: any } | null> {
    const res = await stub.fetch(new Request('https://internal/api/tools/execute', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': auth!.userId,
        'X-App-Action': 'true',
      },
      body: JSON.stringify({ tool: 'records.get', params: { collection, recordId } }),
    }))
    if (!res.ok) throw new Error(`records.get failed (${res.status})`)
    const out = (await res.json()) as {
      success: boolean
      error?: string
      data?: { record?: { recordId: string; data: any } }
    }
    if (!out.success) return null
    return out.data?.record ?? null
  }

  const gameRec = await doGet('games', gameId)
  if (!gameRec) return c.json({ error: 'Game not found' }, 404)
  const game = gameRec.data as Record<string, any>
  if (game.hostId !== auth.userId) {
    return c.json({ error: 'Forbidden' }, 403)
  }

  const [players, answers, questions] = await Promise.all([
    doQuery('players', { where: { gameId } }),
    doQuery('answers', { where: { gameId } }),
    doQuery('questions', { where: { quizId: game.quizId } }),
  ])

  const sortedQuestions = [...questions].sort(
    (a, b) => (a.data.order ?? 0) - (b.data.order ?? 0),
  )

  const answersByPlayer = new Map<string, any[]>()
  for (const a of answers) {
    const list = answersByPlayer.get(a.data.playerId) ?? []
    list.push(a.data)
    answersByPlayer.set(a.data.playerId, list)
  }

  const totalQuestions = sortedQuestions.length

  const leaderboard = players
    .filter((p) => !p.data.kicked)
    .map((p) => {
      const ans = answersByPlayer.get(p.recordId) ?? []
      const correct = ans.filter((a) => a.correct).length
      const totalRt = ans.reduce(
        (s: number, a: any) => s + (a.responseTimeMs ?? 0),
        0,
      )
      return {
        nickname: String(p.data.nickname ?? ''),
        score: Number(p.data.score ?? 0),
        accuracy: totalQuestions > 0 ? correct / totalQuestions : 0,
        avgResponseMs: ans.length > 0 ? Math.round(totalRt / ans.length) : 0,
      }
    })
    .sort((a, b) => b.score - a.score)

  const answersByQ = new Map<number, any[]>()
  for (const a of answers) {
    const idx = a.data.questionIndex as number
    const list = answersByQ.get(idx) ?? []
    list.push(a.data)
    answersByQ.set(idx, list)
  }

  const perQuestion = sortedQuestions.map((q, i) => {
    const ans = answersByQ.get(i) ?? []
    const total = ans.length
    const correct = ans.filter((a) => a.correct).length
    const totalRt = ans.reduce(
      (s: number, a: any) => s + (a.responseTimeMs ?? 0),
      0,
    )
    return {
      index: i,
      text: String(q.data.text ?? ''),
      correctRate: total > 0 ? correct / total : 0,
      avgResponseMs: total > 0 ? Math.round(totalRt / total) : 0,
    }
  })

  const lines: string[] = []
  lines.push('Leaderboard')
  lines.push(['rank', 'nickname', 'score', 'accuracy%', 'avgResponseTimeMs'].join(','))
  leaderboard.forEach((p, i) => {
    lines.push(
      [
        String(i + 1),
        csvEscape(p.nickname),
        String(p.score),
        String(Math.round(p.accuracy * 100)),
        String(p.avgResponseMs),
      ].join(','),
    )
  })
  lines.push('')
  lines.push('Per question')
  lines.push(['questionIndex', 'questionText', 'correctRate%', 'avgResponseTimeMs'].join(','))
  for (const q of perQuestion) {
    lines.push(
      [
        String(q.index + 1),
        csvEscape(q.text || `Question ${q.index + 1}`),
        String(Math.round(q.correctRate * 100)),
        String(q.avgResponseMs),
      ].join(','),
    )
  }

  const csv = lines.join('\r\n') + '\r\n'

  // In-progress assignments have endedAt=0; use today so the filename
  // doesn't print "unknown" or "1970-01-01".
  const datePart = game.endedAt
    ? new Date(game.endedAt as number).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10)
  const pin = String(game.pin ?? gameId).replace(/[^A-Za-z0-9_-]/g, '')
  const filename = `popquiz-game-${pin}-${datePart}.csv`

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'CSV export failed'
    return c.json({ error: msg }, 500)
  }
})

function csvEscape(value: string): string {
  if (value == null) return ''
  const needs = /[",\r\n]/.test(value)
  const escaped = value.replace(/"/g, '""')
  return needs ? `"${escaped}"` : escaped
}

// ---------------------------------------------------------------------------
// Same-origin browser proxy for authenticated DeepSpace billing hooks.
const BROWSER_PROXY_ROUTES = [
  ['GET', '/_deepspace/subscriptions/me'],
  ['POST', '/_deepspace/subscriptions/checkout'],
  ['POST', '/_deepspace/subscriptions/portal'],
  ['POST', '/_deepspace/charges/create'],
  ['GET', '/_deepspace/charges/me'],
] as const

app.all('/_deepspace/*', async (c) => {
  const url = new URL(c.req.url)
  const method = c.req.method
  const allowed = BROWSER_PROXY_ROUTES.some(
    ([allowedMethod, path]) => allowedMethod === method && path === url.pathname,
  )
  if (!allowed) return c.json({ error: 'not_found' }, 404)

  const auth = await resolveAuth(c.req.raw, c.env)
  const userId = auth?.userId
  if (!userId) return c.json({ error: 'unauthorized' }, 401)

  const forwardedParams = new URLSearchParams(url.search)
  forwardedParams.set('appId', c.env.DEEPSPACE_APP_ID)
  const queryString = forwardedParams.toString()
  const apiPath =
    url.pathname.replace('/_deepspace/', '/api/') + (queryString ? `?${queryString}` : '')

  const headers = new Headers(c.req.raw.headers)
  headers.delete('x-user-id')
  headers.delete('x-app-identity-token')
  headers.delete('x-app-id')
  if (c.env.APP_IDENTITY_TOKEN) {
    headers.set('x-app-identity-token', c.env.APP_IDENTITY_TOKEN)
    headers.set('x-app-id', c.env.DEEPSPACE_APP_ID)
  }
  headers.set('x-user-id', userId)

  return apiWorkerFetch(c.env, apiPath, {
    method,
    headers,
    body: ['GET', 'HEAD'].includes(method) ? undefined : c.req.raw.body,
  })
})

// ---------------------------------------------------------------------------
// Static assets (SPA fallback)
// ---------------------------------------------------------------------------

app.get('*', async (c) => {
  const response = await c.env.ASSETS.fetch(c.req.raw)
  if (response.status === 404) {
    const url = new URL(c.req.url)
    url.pathname = '/index.html'
    return c.env.ASSETS.fetch(new Request(url.toString(), c.req.raw))
  }
  return response
})

// =============================================================================
// Action Tools — route to app's own RecordRoom DO
// =============================================================================

function createActionTools(env: Env, userId: string, callerJwt: string): ActionTools {
  const stub = env.RECORD_ROOMS.get(env.RECORD_ROOMS.idFromName(`app:${env.APP_NAME}`))

  async function execTool<TData = unknown>(
    tool: string,
    params: Record<string, unknown>,
  ): Promise<ActionResult<TData>> {
    const res = await stub.fetch(new Request('https://internal/api/tools/execute', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': userId,
        'X-App-Action': 'true',
      },
      body: JSON.stringify({ tool, params }),
    }))
    return res.json() as Promise<ActionResult<TData>>
  }

  async function callIntegration<T = unknown>(endpoint: string, data?: unknown): Promise<ActionResult<T>> {
    const integrationName = endpoint.split('/')[0]
    const billingMode = integrations[integrationName]?.billing ?? 'developer'

    // Owner JWT for developer-billed calls, caller's JWT otherwise.
    // The api-worker bills the JWT subject — no client-supplied override.
    const jwt = billingMode === 'developer' ? env.APP_OWNER_JWT : callerJwt

    const res = await apiWorkerFetch(env, `/api/integrations/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${jwt}`,
      },
      body: data != null ? JSON.stringify(data) : undefined,
    })
    return res.json() as Promise<ActionResult<T>>
  }

  return {
    create: (collection, data, recordId) =>
      execTool('records.create', recordId ? { collection, data, recordId } : { collection, data }),
    update: (collection, recordId, data) => execTool('records.update', { collection, recordId, data }),
    remove: (collection, recordId) => execTool('records.delete', { collection, recordId }),
    get: (collection, recordId) => execTool('records.get', { collection, recordId }),
    query: (collection, options) => execTool('records.query', { collection, ...options }),
    integration: callIntegration,
    registerUser: (opts) => execTool('users.register', opts as Record<string, unknown>),
  }
}

export default app
