/**
 * Vendors every remote image the prototype uses into public/images/.
 *
 * The demo used to hotlink images.unsplash.com and i.pravatar.cc, which meant
 * it rendered blank anywhere those hosts are unreachable — Codespaces behind a
 * restricted network policy, corporate proxies, offline. Run this once and
 * commit the result; src/data/media.js already points at the local paths.
 *
 *   node scripts/fetch-images.mjs           # skips files already present
 *   node scripts/fetch-images.mjs --force   # re-downloads everything
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
  ['auth-hero.jpg',       unsplash('1512917774080-9991f1c4c750', 1200, 1600)],
  ['site-aerial.jpg',     unsplash('1503387762-592deb58ef4e', 800, 500)],
  ['slab-pour.jpg',       unsplash('1541888946425-d81bb19240f5', 800, 600)],
  ['crane.jpg',           unsplash('1504307651254-35680f356dfd', 800, 600)],
  ['concrete-cone.jpg',   unsplash('1590069261209-f8e9b8642343', 800, 600)],
  ['rebar.jpg',           unsplash('1581094794329-c8112a89af12', 800, 600)],
  ['ducting.jpg',         unsplash('1621905251189-08b45d6a269e', 800, 600)],
  ['blueprint-tablet.jpg',unsplash('1581092160562-40aa08e78837', 800, 600)],
]

/* The six pravatar ids the fixtures reference, pulled at the largest size the
   app asks for (240px) so every smaller render just scales down. */
const AVATAR_IDS = [12, 13, 33, 45, 52, 60]
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

console.log('\nDone. Commit public/images/ so the demo renders without network access.')
