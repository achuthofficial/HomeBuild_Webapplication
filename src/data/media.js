/**
 * The photography on the sign-in screens.
 *
 * This is the only place in the app that hard-codes an image. Everything
 * else — avatars, site-update photos — comes out of Supabase Storage with the
 * row that references it, so there is nothing else to configure here.
 *
 * These are REMOTE URLs, deliberately, and they are the exception to the rest
 * of the app's no-hotlinking rule. `scripts/fetch-images.mjs` used to vendor
 * them into public/images/ and this file pointed at the local copies, which is
 * the better default for screens a signed-in manager depends on. The sign-in
 * screen is not one of those: it is unauthenticated, decorative, degrades to a
 * neutral placeholder via `onImageError` when a host is unreachable, and
 * keeping it remote means a fresh clone renders correctly with no build step.
 *
 * If you would rather vendor them: `npm run images`, then swap the four URLs
 * below for `/images/auth-hero.jpg` and `/images/avatars/<id>.jpg`.
 */

export const media = {
  /** Sign-in hero: modern house at dusk with a reflecting pool. */
  authHero:
    'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&h=1600&q=70',
}

/**
 * A stable face for the "+1,200 project managers already joined" stack.
 *
 * `size` is accepted for call-site compatibility and ignored — the stack
 * renders at 24px and one 240px source scales down cleanly.
 */
export const avatar = (id, size) => {
  void size
  return `https://i.pravatar.cc/240?img=${id}`
}
