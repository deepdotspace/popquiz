/**
 * Navigation Config
 */

import type { Role } from './constants'

export interface NavItem {
  path: string
  label: string
  roles?: Role[]
}

export const nav: NavItem[] = [
  { path: '/home', label: 'Home' },
  { path: '/quizzes', label: 'My Kahoots', roles: ['member' as Role] },
  { path: '/reports', label: 'Reports', roles: ['member' as Role] },
  { path: '/play', label: 'Join a game' },
]
