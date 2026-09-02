/**
 * Every external image URL used by the prototype lives here so the whole
 * demo can be re-pointed at real assets from a single file.
 */

const unsplash = (id, w = 800, h = 600) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=70&h=${h}`

export const media = {
  /** Sign-in hero: modern house at dusk with a pool. */
  authHero: unsplash('1512917774080-9991f1c4c750', 1200, 1600),

  /** Site-update and feed photography. */
  siteAerial: unsplash('1503387762-592deb58ef4e', 800, 500),
  slabPour: unsplash('1541888946425-d81bb19240f5', 400, 300),
  crane: unsplash('1504307651254-35680f356dfd', 400, 300),
  concreteCone: unsplash('1590069261209-f8e9b8642343', 400, 300),
  rebar: unsplash('1581094794329-c8112a89af12', 400, 300),
  ducting: unsplash('1621905251189-08b45d6a269e', 400, 300),
  blueprintTablet: unsplash('1581092160562-40aa08e78837', 400, 300),
}

/** Deterministic avatar for a given person id — keeps demo faces stable. */
export const avatar = (id, size = 96) => `https://i.pravatar.cc/${size}?img=${id}`
