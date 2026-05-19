/**
 * Quiz + question CRUD actions.
 *
 * All run server-side and bypass user-RBAC, so we hand-check ownership
 * before mutating anyone's quiz/questions.
 */

import type { ActionHandler, ActionTools } from 'deepspace/worker'
import { patchRecord, queryRecords, unwrap } from './_helpers'
import type { Quiz, Question } from '../lib/types'

async function ownsQuiz(tools: ActionTools, quizId: string, userId: string): Promise<boolean> {
  const res = await tools.get('quizzes', quizId)
  const quiz = unwrap<Quiz>(res)
  return !!quiz && quiz.ownerId === userId
}

export const createQuiz: ActionHandler = async ({ userId, params, tools }) => {
  const title = String(params.title ?? '').trim()
  if (!title) return { success: false, error: 'Title required' }
  return tools.create('quizzes', {
    title,
    description: String(params.description ?? ''),
    theme: String(params.theme ?? 'classic'),
    coverImage: String(params.coverImage ?? ''),
    ownerId: userId,
  })
}

export const updateQuiz: ActionHandler = async ({ userId, params, tools }) => {
  const quizId = String(params.quizId ?? '')
  if (!quizId) return { success: false, error: 'quizId required' }
  if (!(await ownsQuiz(tools, quizId, userId))) return { success: false, error: 'Forbidden' }
  const patch = (params.patch ?? {}) as Partial<Quiz>
  return patchRecord(tools, 'quizzes', quizId, patch)
}

export const deleteQuiz: ActionHandler = async ({ userId, params, tools }) => {
  const quizId = String(params.quizId ?? '')
  if (!quizId) return { success: false, error: 'quizId required' }
  if (!(await ownsQuiz(tools, quizId, userId))) return { success: false, error: 'Forbidden' }
  // Cascade: delete questions first
  const qs = await queryRecords<Question>(tools, 'questions', { where: { quizId } })
  for (const q of qs) await tools.remove('questions', q.recordId)
  return tools.remove('quizzes', quizId)
}

export const duplicateQuiz: ActionHandler = async ({ userId, params, tools }) => {
  const quizId = String(params.quizId ?? '')
  if (!quizId) return { success: false, error: 'quizId required' }
  const original = await tools.get('quizzes', quizId)
  const o = unwrap<Quiz>(original)
  if (!o) return { success: false, error: 'Not found' }
  const created = await tools.create('quizzes', {
    title: `${o.title} (copy)`,
    description: o.description,
    theme: o.theme,
    coverImage: o.coverImage,
    ownerId: userId,
  })
  if (!created.success || !created.data) return created
  const newQuizId = (created.data as Record<string, unknown>).recordId as string
    ?? (created.data as Record<string, unknown>).id as string
  const qs = await queryRecords<Question>(tools, 'questions', { where: { quizId } })
  for (const q of qs) {
    await tools.create('questions', {
      ...q.data,
      quizId: newQuizId,
      ownerId: userId,
    })
  }
  return { success: true, data: { recordId: newQuizId } }
}

export const createQuestion: ActionHandler = async ({ userId, params, tools }) => {
  const quizId = String(params.quizId ?? '')
  if (!quizId) return { success: false, error: 'quizId required' }
  if (!(await ownsQuiz(tools, quizId, userId))) return { success: false, error: 'Forbidden' }
  return tools.create('questions', {
    quizId,
    order: Number(params.order ?? 0),
    type: String(params.type ?? 'mcq'),
    text: String(params.text ?? ''),
    data: typeof params.data === 'string' ? params.data : JSON.stringify(params.data ?? {}),
    timeLimit: Number(params.timeLimit ?? 20),
    pointsMode: String(params.pointsMode ?? 'standard'),
    mediaType: String(params.mediaType ?? 'none'),
    mediaUrl: String(params.mediaUrl ?? ''),
    ownerId: userId,
  })
}

export const updateQuestion: ActionHandler = async ({ userId, params, tools }) => {
  const questionId = String(params.questionId ?? '')
  if (!questionId) return { success: false, error: 'questionId required' }
  const existing = await tools.get('questions', questionId)
  const q = unwrap<Question>(existing)
  if (!q) return { success: false, error: 'Not found' }
  if (q.ownerId !== userId) return { success: false, error: 'Forbidden' }
  const patch = { ...((params.patch ?? {}) as Partial<Question>) }
  if (patch.data !== undefined && typeof patch.data !== 'string') {
    patch.data = JSON.stringify(patch.data)
  }
  return patchRecord(tools, 'questions', questionId, patch)
}

export const deleteQuestion: ActionHandler = async ({ userId, params, tools }) => {
  const questionId = String(params.questionId ?? '')
  if (!questionId) return { success: false, error: 'questionId required' }
  const existing = await tools.get('questions', questionId)
  const q = unwrap<Question>(existing)
  if (!q) return { success: false, error: 'Not found' }
  if (q.ownerId !== userId) return { success: false, error: 'Forbidden' }
  return tools.remove('questions', questionId)
}

export const reorderQuestions: ActionHandler = async ({ userId, params, tools }) => {
  const quizId = String(params.quizId ?? '')
  const orderedIds = Array.isArray(params.orderedIds) ? params.orderedIds as string[] : []
  if (!quizId || orderedIds.length === 0) return { success: false, error: 'quizId + orderedIds required' }
  if (!(await ownsQuiz(tools, quizId, userId))) return { success: false, error: 'Forbidden' }
  for (let i = 0; i < orderedIds.length; i++) {
    await patchRecord(tools, 'questions', orderedIds[i], { order: i })
  }
  return { success: true }
}
