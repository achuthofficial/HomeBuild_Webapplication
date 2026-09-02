# Image credits

Every image in this folder is vendored into the repository by
`scripts/fetch-images.mjs`. Nothing here is fetched at runtime — the demo
renders with no outbound network access.

Re-download (or repair) the folder with:

```bash
npm run images          # skips files already present
npm run images -- --force
```

## Photography — Unsplash

Source: `https://images.unsplash.com/photo-<id>?auto=format&fit=crop&w=…&q=70&h=…`

| File | Unsplash photo id | Used by |
|---|---|---|
| `auth-hero.jpg` | `1512917774080-9991f1c4c750` | Sign In hero panel |
| `site-aerial.jpg` | `1503387762-592deb58ef4e` | Dashboard site-updates rail |
| `slab-pour.jpg` | `1541888946425-d81bb19240f5` | Construction feed |
| `crane.jpg` | `1504307651254-35680f356dfd` | Construction feed |
| `concrete-cone.jpg` | `1590069261209-f8e9b8642343` | Construction feed |
| `rebar.jpg` | `1581094794329-c8112a89af12` | Construction feed |
| `ducting.jpg` | `1621905251189-08b45d6a269e` | Construction feed |
| `blueprint-tablet.jpg` | `1581092160562-40aa08e78837` | Construction feed |

Licensed under the [Unsplash License](https://unsplash.com/license), which
permits free commercial and non-commercial use without permission or
attribution. Attribution is recorded here anyway as a courtesy and so the
source of each file stays traceable.

## Avatars — pravatar.cc

Source: `https://i.pravatar.cc/240?img=<id>`

Ids `12`, `13`, `33`, `45`, `52`, `60`, stored as `avatars/<id>.jpg` and scaled
down by the browser at every render (26px in a stack, 32px in the topbar,
240px on Settings).

> **Note.** These are photographs of real people, served by pravatar as
> placeholder faces. The prototype presents them as named staff (Manish Kumar,
> Rekha Gupta, Dhawan Singh and the team stacks). That is fine for an internal
> demo, but they should be replaced with commissioned photography, generated
> faces, or initials tiles before anything ships publicly or is used in
> marketing material. `src/data/media.js` is the single place to swap them.

## Adding or changing an image

1. Add the filename and source URL to the manifest in `scripts/fetch-images.mjs`.
2. Reference it from `src/data/media.js` (new avatar ids also go in `AVATAR_IDS`).
3. Run `npm run images`, then commit the new file and this table.
