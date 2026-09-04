/**
 * Fallback profile fields for the signed-in user.
 *
 * Identity (id, name, email, avatar) now comes from Firebase — see
 * AuthContext.toProfile, and the role/phone/job title come from the Supabase
 * profile row. These are only the labels shown while that row loads.
 *
 * The Settings counters used to live here too, as fixed numbers rendered
 * under the signed-in user's own name and photo. They are counted from the
 * database now — see getProfileStats.
 */
export const demoProfile = {
  role: 'Senior Project Manager',
  phone: '+91 64589 40458',
}
