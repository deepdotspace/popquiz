/**
 * Shared utilities for server-action handlers.
 *
 * Patch helper: `tools.update` is a full-replace (no merge), so partial
 * updates need a get → merge → update dance. Same shape every action would
 * write — extracted here.
 *
 * Query helper: `tools.query` returns an ActionResult where the records
 * may live at .data.records OR .data depending on shape. Normalize once.
 */

import type { ActionTools, ActionResult } from 'deepspace/worker'

export interface RecordRow<T = Record<string, unknown>> {
  recordId: string
  data: T
}

/** Read existing → shallow-merge → write back. Returns the merged record. */
export async function patchRecord<T extends Record<string, unknown>>(
  tools: ActionTools,
  collection: string,
  recordId: string,
  patch: Partial<T>,
): Promise<ActionResult> {
  const existing = await tools.get(collection, recordId)
  if (!existing.success || !existing.data) {
    return { success: false, error: existing.error ?? 'Record not found' }
  }
  const current = (existing.data as Record<string, unknown>).data ?? existing.data
  const merged = { ...(current as Record<string, unknown>), ...patch }
  return tools.update(collection, recordId, merged)
}

export async function queryRecords<T = Record<string, unknown>>(
  tools: ActionTools,
  collection: string,
  options: Record<string, unknown> = {},
): Promise<RecordRow<T>[]> {
  const res = await tools.query(collection, options)
  if (!res.success || !res.data) return []
  const raw = res.data as Record<string, unknown>
  const list = Array.isArray(raw.records) ? raw.records : Array.isArray(raw) ? raw : []
  return list as RecordRow<T>[]
}

/** Pull a record's data field across the 3 wrapper shapes the SDK uses. */
export function unwrap<T = Record<string, unknown>>(res: ActionResult): T | null {
  if (!res.success || !res.data) return null
  const raw = res.data as Record<string, unknown>
  const record = raw.record as Record<string, unknown> | undefined
  if (record && record.data && typeof record.data === 'object') return record.data as T
  if (raw.data && typeof raw.data === 'object') return raw.data as T
  return raw as T
}
