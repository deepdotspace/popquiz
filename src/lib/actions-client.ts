/**
 * Client-side wrapper for `/api/actions/<name>`.
 *
 * The SDK ships `useQuery`/`useMutations` for record CRUD but no public hook
 * for invoking server actions. Every app reinvents this thin auth+JSON
 * wrapper. Pattern lifted from prior scaffolds.
 */

import { getAuthToken } from 'deepspace'
import { getGuestSecret } from './guest-identity'

export interface ActionResultClient<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

export async function callAction<T = unknown>(
  name: string,
  params: Record<string, unknown> = {},
): Promise<ActionResultClient<T>> {
  let token: string | null = null
  try {
    token = await getAuthToken()
  } catch {
    token = null
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  } else {
    // Signed out. The worker accepts this only for the actions on its public
    // allowlist (joining and answering) and derives the caller's guest id from
    // it; everything else still answers 401. Sent only when there is no token
    // so a signed-in caller can never be downgraded to a guest identity.
    headers['X-Guest-Secret'] = getGuestSecret()
  }

  try {
    const res = await fetch(`/api/actions/${name}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(params),
    })
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>
    if (!res.ok) {
      return { success: false, error: (body.error as string) ?? `Action failed (${res.status})` }
    }
    return body as unknown as ActionResultClient<T>
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Network error' }
  }
}
