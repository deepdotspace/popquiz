/**
 * AI quiz generation: turn a topic prompt or a URL into a draft quiz.
 *
 * One-shot (no streaming, no tools). The host gets back JSON, the editor
 * lets them tweak, and only saving creates real records — so a bad
 * generation just costs the round-trip.
 *
 * Billing: developer-billed (APP_OWNER_JWT). Treat AI quiz gen as a
 * platform-paid demo feature for the MVP; switch to user-billed later if
 * you want hosts to pay per generation.
 */

import type { Hono } from 'hono'
import { generateText } from 'ai'
import { createDeepSpaceAI } from 'deepspace/worker'
import type { VerifyResult } from 'deepspace/worker'
import type { Env, AppContext } from '../../worker.js'

type ResolveAuth = (req: Request, env: Env) => Promise<VerifyResult | null>

const MODEL = 'claude-sonnet-4-6'
const MAX_URL_TEXT = 10_000

interface DraftQuiz {
  title: string
  description?: string
  questions: DraftQuestion[]
}

interface DraftQuestion {
  type: 'mcq' | 'true_false' | 'type_answer'
  text: string
  timeLimit: number
  options?: { text: string; correct: boolean }[]
  correctAnswer?: string | boolean
}

export function registerAiQuizRoutes(app: Hono<AppContext>, resolveAuth: ResolveAuth): void {
  app.post('/api/ai/generate-quiz', async (c) => {
    const auth = await resolveAuth(c.req.raw, c.env)
    if (!auth) return c.json({ success: false, error: 'Unauthorized' }, 401)

    // Forward the caller's bearer for the AI proxy. APP_OWNER_JWT may be
    // empty in dev, and even when set, billing the actual user is what we
    // want for a per-host AI feature.
    const authHeader = c.req.header('Authorization') ?? ''
    const callerJwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
    if (!callerJwt) return c.json({ success: false, error: 'Missing auth' }, 401)

    const body = await c.req.json<{
      mode?: 'topic' | 'url'
      input?: string
      count?: number
    }>().catch(() => ({} as Record<string, unknown>))

    const mode = body.mode === 'url' ? 'url' : 'topic'
    const input = String(body.input ?? '').trim()
    const count = Math.max(3, Math.min(20, Number(body.count ?? 8)))
    if (!input) return c.json({ success: false, error: 'input required' }, 400)

    let context = ''
    if (mode === 'topic') {
      context = `Topic: ${input}`
    } else {
      try {
        const url = new URL(input)
        const res = await fetch(url.toString(), {
          headers: { 'User-Agent': 'PopQuizClone/1.0' },
          signal: AbortSignal.timeout(15_000),
        })
        if (!res.ok) {
          return c.json({ success: false, error: `Failed to fetch URL (${res.status})` }, 400)
        }
        const html = await res.text()
        const text = htmlToText(html).slice(0, MAX_URL_TEXT)
        if (text.length < 200) {
          return c.json({ success: false, error: 'URL has too little readable text' }, 400)
        }
        context = `Source URL: ${url.toString()}\n\nContent:\n${text}`
      } catch (err) {
        return c.json({ success: false, error: err instanceof Error ? err.message : 'URL fetch failed' }, 400)
      }
    }

    const ai = createDeepSpaceAI(c.env, 'anthropic', { authToken: callerJwt })

    const systemPrompt = `You are an expert quiz writer. Given source material, produce a JSON quiz suitable for a live quiz game show.

Rules:
- Output ONLY valid JSON. No commentary, no markdown fences.
- Match this exact shape:
  {
    "title": "short title",
    "description": "1-2 sentence description",
    "questions": [
      {
        "type": "mcq" | "true_false" | "type_answer",
        "text": "question text — under 120 characters",
        "timeLimit": 20,
        "options": [{"text": "...", "correct": true|false}, ...]   // for mcq only, exactly 4 entries with one true
        "correctAnswer": true|false                                 // for true_false only
      }
    ]
  }
- For type_answer questions, omit options and use "correctAnswer" as the expected string.
- Mix question types but bias 70%+ to "mcq".
- Time limit: 20s default, 10s for true_false, 30s for harder mcq/type_answer.
- Keep questions kid-safe and free of bias.`

    const userPrompt = `${context}\n\nGenerate ${count} questions.`

    let raw: string
    try {
      const result = await generateText({
        model: ai(MODEL),
        system: systemPrompt,
        prompt: userPrompt,
      })
      raw = result.text
    } catch (err) {
      console.error('[ai-quiz] generation error', err)
      return c.json({
        success: false,
        error: err instanceof Error ? err.message : 'AI generation failed',
      }, 502)
    }

    let parsed: DraftQuiz
    try {
      parsed = JSON.parse(stripCodeFences(raw)) as DraftQuiz
    } catch (err) {
      console.error('[ai-quiz] JSON parse failed', { raw: raw.slice(0, 500) })
      return c.json({ success: false, error: 'AI returned invalid JSON' }, 502)
    }

    if (!parsed.title || !Array.isArray(parsed.questions) || parsed.questions.length === 0) {
      return c.json({ success: false, error: 'AI returned empty quiz' }, 502)
    }

    return c.json({ success: true, data: parsed })
  })
}

// HTML → plain text. Removes script/style blocks, then strips remaining tags
// and decodes a handful of common entities. Good enough for arbitrary blogs
// and Wikipedia; not a replacement for cheerio.
function htmlToText(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, ' ')
    .trim()
}

// Models occasionally wrap JSON in ```json ... ``` despite the system prompt.
function stripCodeFences(s: string): string {
  const trimmed = s.trim()
  const fence = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/)
  return fence ? fence[1] : trimmed
}
