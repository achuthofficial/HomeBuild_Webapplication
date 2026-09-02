/**
 * Graceful degradation for images that fail to load.
 *
 * Vendored images can still go missing — someone clones the repo before
 * running scripts/fetch-images.mjs, or a file is dropped from public/images/.
 * The browser default in that case is a broken-image glyph and an alt-text
 * flash, which looks like a bug rather than a gap.
 *
 * These handlers swap the source for a transparent pixel and tag the element,
 * so the styling in index.css can paint a neutral placeholder using the theme
 * tokens. Doing it in CSS rather than baking colours into an inline SVG is
 * what keeps the placeholder correct in dark mode.
 */

/** 1x1 transparent GIF — a valid image, so no broken-image glyph is drawn. */
const TRANSPARENT =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

function fail(event, variant) {
  const img = event.currentTarget
  // The swap below fires error again on some browsers; the tag stops the loop.
  if (img.dataset.fallback) return
  img.dataset.fallback = variant
  img.src = TRANSPARENT
}

/** Photography — site feed, hero, dashboard rail. */
export const onImageError = (event) => fail(event, 'photo')

/** Avatars — round, so the placeholder must not draw a landscape glyph. */
export const onAvatarError = (event) => fail(event, 'avatar')
