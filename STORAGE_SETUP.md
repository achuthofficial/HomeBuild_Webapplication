# File storage setup

HomeBuild stores uploaded images in **Supabase Storage** while authentication
stays with **Firebase**. This document covers the bridge between them, the two
buckets, and the policies that actually enforce access.

Storage is optional. Without `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`,
the upload buttons keep the prototype's "not configured" message and nothing
else changes.

---

## Why a bridge is needed at all

Supabase Storage policies are written against `auth.uid()` / `auth.jwt()`,
which normally come from a **Supabase Auth** session. Your users sign in with
**Firebase**, so by default Supabase sees every request as anonymous and no
per-user policy can work.

The fix is to have Supabase trust Firebase as an external token issuer. Then a
Firebase ID token is a valid Supabase credential, and the Firebase UID lands in
the JWT's `sub` claim where policies can read it.

In this app that is one hook, in `src/lib/supabaseStorage.js`:

```js
createClient(url, anonKey, {
  accessToken: async () => auth.currentUser?.getIdToken() ?? null,
})
```

Every Storage request now carries the signed-in Firebase user's token.

> ⚠️ **Verify this against current Supabase docs before relying on it.**
> Third-party auth integrations have moved between beta and GA, and the exact
> console location and required claims have changed over time. The client code
> above is stable; the *dashboard* steps in section 2 are the part most likely
> to have shifted since this was written.

---

## 1. Create the buckets

**Storage → Buckets.** Create two:

| Bucket | Public? | Holds |
|---|---|---|
| `avatars` | **Public** | Profile pictures |
| `site-photos` | **Private** | Construction site photography |

The split is deliberate. An avatar URL is written into the Firebase user
profile and has to keep working without re-signing, so that bucket is public.
Site photos are client project data and are served through short-lived signed
URLs instead — "an unguessable URL" is not access control.

Set a file size limit of **10 MB** on both, and restrict allowed MIME types to
`image/jpeg, image/png, image/webp, image/heic`. The client validates the same
rules up front so users hear about an oversized file immediately, but the
bucket limit is what actually enforces it.

---

## 2. Register Firebase as a third-party auth provider

In the Supabase dashboard, add Firebase as a third-party auth integration and
supply your **Firebase project ID**. Supabase then validates incoming Firebase
ID tokens against Google's public keys.

Once configured, a Firebase ID token presented to Supabase yields:

- `auth.jwt() ->> 'sub'` — the Firebase UID
- `auth.jwt() ->> 'email'` — the user's email
- `auth.jwt() ->> 'aud'` — your Firebase project ID

The policies below key on `sub`.

---

## 3. Apply the policies

Run this in the Supabase SQL editor. It assumes the buckets from section 1
exist.

```sql
-- ---------------------------------------------------------------- avatars --
```

Note the index difference: avatars are `<uid>/avatar.jpg` so the UID is segment
**1**, while site photos are `<entryId>/<uid>/<file>` so the UID is segment
**2**. Getting this wrong is the most likely cause of an upload failing with a
row-level-security error.

> **Superseded.** Read access to `site-photos` used to be "any signed-in
> user". It is now scoped to project membership, alongside the table policies
> — a user who cannot see a project can no longer read its photography by
> listing the bucket. The current storage policies live at the bottom of
> `supabase/schema.sql` so every policy is in one file; run that rather than
> the block above.

---

## 4. Verify

1. Sign in, go to **Settings**, click the camera badge on the avatar, pick an
   image. It should upload, appear immediately, and survive a page reload —
   persistence comes from the URL being written to the Firebase profile.
2. Go to **Construction** and click a dashed upload slot on the "HVAC Ducting"
   entry. The photo should appear with a **NEW** badge and still be there after
   a reload.

If an upload fails with a permissions message, check in this order: the buckets
exist and are named exactly as above; the third-party auth integration is
configured; the segment index in the policy matches the path shape.

---

## How persistence works without a database

This app still has no database, which shapes the design:

- **Avatars** persist because the public URL is written back to the Firebase
  user's `photoURL`. Firebase Auth is doing the storing.
- **Site photos** persist because **the storage prefix is the index**. Files
  live under `site-photos/<entryId>/<uid>/`, and `listSitePhotos(entryId)` reads
  them back on mount. No table records the association — the path does.

That is genuinely durable, but it has limits worth knowing before you build on
it: there is nowhere to record a caption, a timestamp beyond the file's own
metadata, or who a photo is visible to. Listing is also two round trips per
entry (folders, then files within them) because Storage's `list` does not
recurse. When project data moves into a real database, photo metadata should
move with it and this listing should be replaced by a query.

---

## Code map

| Concern | Where |
|---|---|
| Client + the Firebase token bridge | `src/lib/supabaseStorage.js` |
| Upload, list, delete, validation | `src/lib/storage.js` |
| Avatar upload + profile write-back | `src/pages/Settings.jsx` |
| Site photo upload + feed rendering | `src/pages/Construction.jsx` |
| Writing the avatar URL to Firebase | `setAvatarUrl` in `src/context/AuthContext.jsx` |
