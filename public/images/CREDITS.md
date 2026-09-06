# Image credits

The sign-in screen is the only place in the app that references a fixed image.
Everything else — avatars, site-update photos — is uploaded by users and served
from Supabase Storage, so it is not covered here.

Those sign-in images are **hotlinked** by `src/data/media.js`, so this folder is
normally empty. It exists for deployments that would rather serve them locally:
run `npm run images` to vendor the files, then point `media.js` at
`/images/auth-hero.jpg` and `/images/avatars/<id>.jpg`.

```bash
npm run images          # skips files already present
npm run images -- --force
```

## Photography — Unsplash

| File | Unsplash photo id | Used by |
|---|---|---|
| `auth-hero.jpg` | `1512917774080-9991f1c4c750` | Sign-in hero panel |

Full URL shape: `https://images.unsplash.com/photo-<id>?auto=format&fit=crop&w=1200&h=1600&q=70`

Licensed under the [Unsplash License](https://unsplash.com/license), which
permits free commercial and non-commercial use without permission or
attribution. Attribution is recorded here anyway as a courtesy and so the
source of each file stays traceable.

## Avatars — pravatar.cc

Source: `https://i.pravatar.cc/240?img=<id>`

Ids `12`, `33`, `45` — the three faces in the sign-in screen's
"+1,200 project managers already joined" stack.

> **Note.** These are photographs of real people, served by pravatar as
> placeholder faces. They carry no implication about who uses HomeBuild, but
> they should be replaced with commissioned photography, generated faces, or
> initials tiles before the marketing site ships. `src/data/media.js` is the
> single place to swap them.

## Changing an image

1. Edit the URL in `src/data/media.js` — that is the whole change.
2. Only if you vendor locally: add it to the manifest in
   `scripts/fetch-images.mjs`, run `npm run images`, and update the table above.
