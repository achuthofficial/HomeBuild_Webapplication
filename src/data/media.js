/**
 * Every image the prototype uses lives in public/images/ and is referenced
 * from here, so the whole demo can be re-pointed from a single file.
 *
 * These used to be remote URLs (images.unsplash.com, i.pravatar.cc), which
 * meant the demo rendered blank anywhere those hosts are unreachable —
 * Codespaces on a restricted network, corporate proxies, offline. The bytes
 * are now vendored into the repo.
 *
 * To (re)populate the folder:  node scripts/fetch-images.mjs
 * Source URLs and licensing:   public/images/CREDITS.md
 */

/* Files in public/ are served from the site root, so these are absolute
   paths rather than bundler imports — no hashing, but media.js stays a plain
   string map and nothing else in the app has to change. */
const IMAGES = '/images'

export const media = {
  /** Sign-in hero: modern house at dusk with a pool. */
  authHero: `${IMAGES}/auth-hero.jpg`,

  /** Site-update and feed photography. */
  siteAerial: `${IMAGES}/site-aerial.jpg`,
  slabPour: `${IMAGES}/slab-pour.jpg`,
  crane: `${IMAGES}/crane.jpg`,
  concreteCone: `${IMAGES}/concrete-cone.jpg`,
  rebar: `${IMAGES}/rebar.jpg`,
  ducting: `${IMAGES}/ducting.jpg`,
  blueprintTablet: `${IMAGES}/blueprint-tablet.jpg`,
}

/**
 * The avatar ids vendored by scripts/fetch-images.mjs. Kept in step with the
 * AVATAR_IDS manifest in that script — asking for an id outside this set
 * would resolve to a file that was never downloaded.
 */
export const AVATAR_IDS = [12, 13, 33, 45, 52, 60]

/**
 * Deterministic avatar for a given person id — keeps demo faces stable.
 *
 * `size` is accepted for call-site compatibility but ignored: one 240px file
 * is stored per id and the browser scales it down to whatever the layout
 * asks for (26px in a stack, 32px in the topbar, 240px on Settings).
 */
export const avatar = (id, size) => {
  if (import.meta.env?.DEV && !AVATAR_IDS.includes(id)) {
    console.warn(
      `[media] avatar(${id}) has no vendored file. Add ${id} to AVATAR_IDS ` +
        `here and in scripts/fetch-images.mjs, then re-run the script.`,
    )
  }
  void size
  return `${IMAGES}/avatars/${id}.jpg`
}
