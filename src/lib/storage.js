import { supabase, BUCKETS, isStorageConfigured } from '@/lib/supabaseStorage'

/**
 * Upload helpers over Supabase Storage.
 *
 * Every function returns `{ data, error }` with an already-readable error
 * message rather than throwing, matching the convention the auth actions use
 * so call sites handle both the same way.
 */

/** Browsers report these for the formats a site photo or avatar can be. */
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic']
const MAX_BYTES = 10 * 1024 * 1024 // 10 MB

/** How long a signed site-photo URL stays valid. */
const SIGNED_URL_TTL = 60 * 60 // 1 hour

/**
 * Client-side validation. The storage policies enforce this server-side too —
 * this exists so the user hears about a 40 MB RAW file immediately rather than
 * after uploading it.
 */
export function validateImage(file) {
  if (!file) return 'No file selected.'
  if (!ALLOWED_TYPES.includes(file.type)) {
    return 'Choose a JPEG, PNG, WebP or HEIC image.'
  }
  if (file.size > MAX_BYTES) {
    const mb = (file.size / 1024 / 1024).toFixed(1)
    return `That image is ${mb} MB. The limit is ${MAX_BYTES / 1024 / 1024} MB.`
  }
  return null
}

/** `photo.JPEG` -> `jpeg`, defaulting to jpg when a name carries no extension. */
function extensionOf(file) {
  const fromName = file.name?.split('.').pop()?.toLowerCase()
  if (fromName && fromName.length <= 5 && /^[a-z0-9]+$/.test(fromName)) {
    return fromName
  }
  return file.type === 'image/png' ? 'png' : 'jpg'
}

/** Collision-proof without needing a database sequence. */
function uniqueName(file) {
  const stamp = Date.now().toString(36)
  const rand = Math.random().toString(36).slice(2, 8)
  return `${stamp}-${rand}.${extensionOf(file)}`
}

/**
 * Downscale before upload — PRD 5.2.5, "auto-compression to 1080p before
 * upload (to handle low-bandwidth sites)".
 *
 * This is not a nicety. The supervisor persona is on a basic Android phone
 * with poor site connectivity, and a modern phone camera produces 4-6 MB
 * files; 1080p JPEG at quality 0.82 is typically 200-400 KB, which is the
 * difference between an upload that finishes and one that times out.
 *
 * Longest edge, not width, so a portrait photo is bounded too. Returns the
 * ORIGINAL FILE on any failure — HEIC in particular is not decodable in most
 * browsers, and a photo that uploads at full size beats one that does not
 * upload at all.
 */
const MAX_EDGE = 1920
const JPEG_QUALITY = 0.82

export async function compressImage(file) {
  if (typeof createImageBitmap !== 'function') return file

  try {
    const bitmap = await createImageBitmap(file)
    const longest = Math.max(bitmap.width, bitmap.height)

    /* Already within budget: re-encoding would cost quality for nothing. */
    if (longest <= MAX_EDGE) {
      bitmap.close?.()
      return file
    }

    const scale = MAX_EDGE / longest
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)

    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close?.()

    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY),
    )
    if (!blob) return file

    /* Guard against the pathological case where re-encoding grows the file. */
    if (blob.size >= file.size) return file

    const name = file.name?.replace(/\.[^.]+$/, '') ?? 'photo'
    return new File([blob], `${name}.jpg`, {
      type: 'image/jpeg',
      lastModified: Date.now(),
    })
  } catch {
    /* Undecodable format (HEIC), tainted canvas, out of memory — upload the
       original rather than failing the supervisor's only job on this screen. */
    return file
  }
}

function unavailable() {
  return {
    data: null,
    error:
      'File storage is not configured for this build. See STORAGE_SETUP.md.',
  }
}

/**
 * Replaces the signed-in user's avatar.
 *
 * Stored at `<uid>/avatar.<ext>` and upserted, so a user keeps exactly one
 * avatar file rather than accumulating every photo they have ever chosen. The
 * bucket is public, so the returned URL can go straight into the Firebase
 * profile and survive without re-signing.
 *
 * A cache-busting query param is appended because upsert reuses the path — the
 * browser would otherwise keep showing the previous image.
 */
export async function uploadAvatar(file, uid) {
  if (!isStorageConfigured) return unavailable()
  if (!uid) return { data: null, error: 'You are not signed in.' }

  const invalid = validateImage(file)
  if (invalid) return { data: null, error: invalid }

  /* An avatar is displayed at 40px; a 12-megapixel one helps nobody. */
  const upload = await compressImage(file)
  const path = `${uid}/avatar.${extensionOf(upload)}`

  const { error } = await supabase.storage
    .from(BUCKETS.avatars)
    .upload(path, upload, { upsert: true, contentType: upload.type })

  if (error) return { data: null, error: readable(error) }

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKETS.avatars).getPublicUrl(path)

  return { data: { path, url: `${publicUrl}?v=${Date.now()}` }, error: null }
}

/**
 * Adds a photo to a site-feed entry.
 *
 * Path is `<entryId>/<uid>/<unique>.<ext>`. With no database to record which
 * photo belongs to which entry, the prefix IS the index — `listSitePhotos`
 * reads them back by entry. Keeping the uid in the path is what lets a policy
 * allow deletes of your own uploads only.
 */
export async function uploadSitePhoto(file, entryId, uid) {
  if (!isStorageConfigured) return unavailable()
  if (!uid) return { data: null, error: 'You are not signed in.' }
  if (!entryId) return { data: null, error: 'Missing feed entry.' }

  const invalid = validateImage(file)
  if (invalid) return { data: null, error: invalid }

  /* Validate the file the user picked, upload the downscaled one. */
  const upload = await compressImage(file)
  const path = `${entryId}/${uid}/${uniqueName(upload)}`

  const { error } = await supabase.storage
    .from(BUCKETS.sitePhotos)
    .upload(path, upload, { contentType: upload.type })

  if (error) return { data: null, error: readable(error) }

  const { data: signed, error: signError } = await supabase.storage
    .from(BUCKETS.sitePhotos)
    .createSignedUrl(path, SIGNED_URL_TTL)

  if (signError) return { data: null, error: readable(signError) }

  return { data: { path, url: signed.signedUrl }, error: null }
}

/**
 * Every photo uploaded against one feed entry, newest first, as signed URLs.
 *
 * Listing is recursive by hand: Storage's list() does not descend, and photos
 * live one level deeper under the uploader's uid.
 */
export async function listSitePhotos(entryId) {
  if (!isStorageConfigured) return { data: [], error: null }

  const { data: userDirs, error } = await supabase.storage
    .from(BUCKETS.sitePhotos)
    .list(entryId, { limit: 100 })

  if (error) return { data: [], error: readable(error) }
  if (!userDirs?.length) return { data: [], error: null }

  /* Entries with no id are folders; each is one uploader. */
  const folders = userDirs.filter((entry) => entry.id === null)

  const nested = await Promise.all(
    folders.map(async (folder) => {
      const { data: files } = await supabase.storage
        .from(BUCKETS.sitePhotos)
        .list(`${entryId}/${folder.name}`, { limit: 100 })

      return (files ?? [])
        .filter((f) => f.id !== null)
        .map((f) => ({
          path: `${entryId}/${folder.name}/${f.name}`,
          uploadedBy: folder.name,
          createdAt: f.created_at ?? null,
        }))
    }),
  )

  const paths = nested.flat().sort((a, b) => {
    if (!a.createdAt || !b.createdAt) return 0
    return b.createdAt.localeCompare(a.createdAt)
  })

  if (!paths.length) return { data: [], error: null }

  /* One batched call rather than one round trip per photo. */
  const { data: signed, error: signError } = await supabase.storage
    .from(BUCKETS.sitePhotos)
    .createSignedUrls(
      paths.map((p) => p.path),
      SIGNED_URL_TTL,
    )

  if (signError) return { data: [], error: readable(signError) }

  return {
    data: paths.map((p, i) => ({ ...p, url: signed?.[i]?.signedUrl ?? null })),
    error: null,
  }
}

/** Removes one site photo. The policies only permit your own uploads. */
export async function deleteSitePhoto(path) {
  if (!isStorageConfigured) return unavailable()

  const { error } = await supabase.storage
    .from(BUCKETS.sitePhotos)
    .remove([path])

  if (error) return { data: null, error: readable(error) }
  return { data: { path }, error: null }
}

/**
 * Storage errors arrive as HTTP-ish messages. The two that users actually hit
 * are worth translating; the rest pass through.
 */
function readable(error) {
  const message = error?.message ?? String(error)

  if (/row-level security|new row violates|not authorized|403/i.test(message)) {
    return 'You do not have permission to store that file. If you just signed in, try again.'
  }
  if (/bucket not found|404/i.test(message)) {
    return 'The storage bucket is missing. See STORAGE_SETUP.md for the buckets this app expects.'
  }
  if (/payload too large|413/i.test(message)) {
    return 'That file is larger than the storage limit allows.'
  }
  if (/failed to fetch|network/i.test(message)) {
    return 'Could not reach file storage. Check your connection.'
  }
  return message
}
