import { avatar } from './media'

/**
 * Fallback profile fields for the signed-in user.
 *
 * Identity (id, name, email, avatar) now comes from Supabase — see
 * AuthContext.toProfile. This supplies only the fields the prototype has no
 * database behind: role, phone and the two counters on the Settings screen.
 * They are placeholders, not the signed-in user's real data.
 */
export const demoProfile = {
  role: 'Senior Project Manager',
  phone: '+91 64589 40458',
  activeProjects: 12,
  teamsLed: '04',
}

/**
 * Retained for the screens that still render fixture content (the Dashboard
 * greeting falls back to this before a session resolves).
 */
export const currentUser = {
  ...demoProfile,
  id: 'usr-demo',
  name: 'Manish Kumar',
  firstName: 'Manish',
  email: 'manish@homebuild.com',
  avatar: avatar(13, 240),
}

/** Team Management rows on the Settings screen. */
export const teamMembers = [
  {
    id: 'usr-rekha',
    name: 'Rekha Gupta',
    role: 'Lead Architect',
    status: 'ACTIVE',
    avatar: avatar(45),
  },
  {
    id: 'usr-dhawan',
    name: 'Dhawan Singh',
    role: 'Site Supervisor',
    status: 'ACTIVE',
    avatar: avatar(12),
  },
]

/** Small avatar pool reused for stacked team clusters across the app. */
export const avatarPool = [
  avatar(13),
  avatar(45),
  avatar(12),
  avatar(33),
  avatar(52),
  avatar(60),
]
