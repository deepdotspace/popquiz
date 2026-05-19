/**
 * Client-side wrapper for `/api/actions/<name>`.
 *
 * The SDK ships `useQuery`/`useMutations` for record CRUD but no public hook
 * for invoking server actions. Every app reinvents this thin auth+JSON
 * wrapper. Pattern lifted from prior scaffolds.
 */

import { getAuthToken } from 'deepspace'

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
  if (token) headers['Authorization'] = `Bearer ${token}`

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
