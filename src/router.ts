// Generouted, changes to this file will be overridden
/* eslint-disable */

import { components, hooks, utils } from '@generouted/react-router/client'

export type Path =
  | `*`
  | `/`
  | `/home`
  | `/host/:gameId`
  | `/play`
  | `/play/:pin`
  | `/quizzes`
  | `/quizzes/:id/edit`
  | `/reports`
  | `/reports/:gameId`
  | `/settings`

export type Params = {
  '/*': { '*': string }
  '/host/:gameId': { gameId: string }
  '/play/:pin': { pin: string }
  '/quizzes/:id/edit': { id: string }
  '/reports/:gameId': { gameId: string }
}

export type ModalPath = never

export const { Link, Navigate } = components<Path, Params>()
export const { useModals, useNavigate, useParams } = hooks<Path, Params, ModalPath>()
export const { redirect } = utils<Path, Params>()
