/**
 * Shared utilities for server-action handlers.
 *
 * `tools.update` is a full-replace (no merge), so partial updates need a
 * get → merge → update dance. Same shape every action would write — extracted
 * here so callers can stay terse.
 */

import type { ActionTools, ActionResult } from 'deepspace/worker'

export interface RecordRow<T = Record<string, unknown>> {
  recordId: string
  data: T
}

/** Read existing → shallow-merge → write back. Returns the update result. */
export async function patchRecord<T extends Record<string, unknown>>(
  tools: ActionTools,
  collection: string,
  recordId: string,
  patch: Partial<T>,
): Promise<ActionResult<{ recordId: string }>> {
  const existing = await tools.get<T>(collection, recordId)
  if (!existing.success) {
    return { success: false, error: existing.error ?? 'Record not found' }
  }
  const merged = { ...existing.data.record.data, ...patch }
  return tools.update<T>(collection, recordId, merged)
}

export async function queryRecords<T extends Record<string, unknown> = Record<string, unknown>>(
  tools: ActionTools,
  collection: string,
  options: { where?: Record<string, unknown>; orderBy?: string; orderDir?: 'asc' | 'desc'; limit?: number } = {},
): Promise<RecordRow<T>[]> {
  const res = await tools.query<T>(collection, options)
  if (!res.success) return []
  return res.data.records.map((r) => ({ recordId: r.recordId, data: r.data }))
}

/** Pull the record's data field from a `tools.get` result, or null if missing. */
export function unwrap<T extends Record<string, unknown> = Record<string, unknown>>(
  res: ActionResult<unknown>,
): T | null {
  if (!res.success) return null
  const data = res.data as { record?: { data?: T } } | undefined
  return data?.record?.data ?? null
}
