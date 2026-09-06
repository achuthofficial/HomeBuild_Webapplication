/**
 * Vendors the sign-in screen's photography into public/images/.
 *
 * OPTIONAL. src/data/media.js points at the remote URLs below, so the sign-in
 * screen renders from a fresh clone with no build step — see the comment at
 * the top of that file for why hotlinking is the right default *there*. This
 * script exists for the case where it is not: a deployment behind a network
 * that blocks images.unsplash.com / i.pravatar.cc, or one that would rather
 * not make an outbound request from an unauthenticated page at all.
 *
 *   node scripts/fetch-images.mjs           # skips files already present
 *   node scripts/fetch-images.mjs --force   # re-downloads everything
 *
 * Then swap the URLs in media.js for /images/auth-hero.jpg and
 * /images/avatars/<id>.jpg, and commit public/images/.
 *
 * Every other image in the app — avatars, site-update photos — comes out of
 * Supabase Storage with the row that references it and is not this script's
 * business.
 *
 * No dependencies — Node 18+ global fetch only.
 */

import { mkdir, writeFile, access } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'public', 'images')

const force = process.argv.includes('--force')

/** Unsplash source photo ids, keyed by the name used in media.js. */
const unsplash = (id, w, h) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=70&h=${h}`

const PHOTOS = [
  ['auth-hero.jpg', unsplash('1512917774080-9991f1c4c750', 1200, 1600)],
]

/* The three faces in the sign-in screen's "+1,200 project managers" stack,
   pulled at 240px so the 24px render just scales down. */
const AVATAR_IDS = [12, 33, 45]
const AVATARS = AVATAR_IDS.map((id) => [
  join('avatars', `${id}.jpg`),
  `https://i.pravatar.cc/240?img=${id}`,
])

const TARGETS = [...PHOTOS, ...AVATARS]

async function exists(path) {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

async function download([name, url]) {
  const dest = join(OUT, name)
  const label = relative(ROOT, dest)

  if (!force && (await exists(dest))) {
    return { name: label, status: 'skip', note: 'already present' }
  }

  let response
  try {
    response = await fetch(url, {
      redirect: 'follow',
      headers: { accept: 'image/*' },
      signal: AbortSignal.timeout(45_000),
    })
  } catch (error) {
    return { name: label, status: 'fail', note: error.message }
  }

  if (!response.ok) {
    return { name: label, status: 'fail', note: `HTTP ${response.status}` }
  }

  /* Guard against a captive portal or error page being written out as a .jpg
     — a proxy denial is usually text/html with a 200. */
  const type = response.headers.get('content-type') ?? ''
  if (!type.startsWith('image/')) {
    return { name: label, status: 'fail', note: `not an image (${type || 'no content-type'})` }
  }

  const bytes = Buffer.from(await response.arrayBuffer())
  if (bytes.byteLength < 1024) {
    return { name: label, status: 'fail', note: `suspiciously small (${bytes.byteLength} B)` }
  }

  await mkdir(dirname(dest), { recursive: true })
  await writeFile(dest, bytes)
  return { name: label, status: 'ok', note: `${(bytes.byteLength / 1024).toFixed(0)} KB` }
}

const MARK = { ok: '✓', skip: '·', fail: '✗' }

console.log(`Fetching ${TARGETS.length} images into ${relative(ROOT, OUT)}/\n`)

/* Sequential rather than parallel: it is a dozen files, and one clear failure
   line beats an interleaved pile of them. */
const results = []
for (const target of TARGETS) {
  const result = await download(target)
  results.push(result)
  console.log(`  ${MARK[result.status]} ${result.name.padEnd(34)} ${result.note}`)
}

const failed = results.filter((r) => r.status === 'fail')
const written = results.filter((r) => r.status === 'ok')

console.log(
  `\n${written.length} downloaded, ` +
    `${results.length - written.length - failed.length} skipped, ` +
    `${failed.length} failed.`,
)

if (failed.length) {
  console.error(
    '\nSome images could not be fetched. If every line failed, this network\n' +
      'blocks images.unsplash.com / i.pravatar.cc — run the script somewhere\n' +
      'with open outbound HTTPS. A single 404 means that source URL is stale\n' +
      'and needs replacing in this file.',
  )
  process.exit(1)
}

console.log(
  '\nDone. Point src/data/media.js at /images/… and commit public/images/ so\n' +
    'the sign-in screen renders without an outbound request.',
)
