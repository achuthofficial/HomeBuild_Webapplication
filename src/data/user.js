import { avatar } from './media'

/** The signed-in demo user, from the Settings mockup. */
export const currentUser = {
  id: 'usr-manish',
  name: 'Manish Kumar',
  firstName: 'Manish',
  role: 'Senior Project Manager',
  email: 'manish@homebuild.com',
  phone: '+91 64589 40458',
  avatar: avatar(13, 240),
  activeProjects: 12,
  teamsLed: '04',
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
