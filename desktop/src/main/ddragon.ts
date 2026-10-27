// Data Dragon: Riot's static game data (champions, items, runes, summoner spells, icons).
// We download one full copy per patch into data/ddragon/<version>/ and read it locally,
// so nothing hits the network during a game.
//
// This file imports nothing from Electron, so it can be run and tested with plain Node.

import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

const BASE = 'https://ddragon.leagueoflegends.com'
const LOCALE = 'en_US'
const PARALLEL_DOWNLOADS = 8
const VERSIONS_TO_KEEP = 2
// Written last; a version folder without it is incomplete and gets re-downloaded.
const COMPLETE_MARKER = '.complete'

export interface EnsureResult {
  version: string
  dir: string
  downloaded: boolean
  offline: boolean
}

type Log = (message: string) => void

interface ImageRef {
  full: string
}
interface DataFile<T> {
  data: Record<string, T>
}
interface RuneStyle {
  icon: string
  slots: { runes: { icon: string }[] }[]
}

// Make sure the newest patch is cached. Falls back to the newest cached patch when offline.
export async function ensureDdragon(dataDir: string, log: Log = () => {}): Promise<EnsureResult> {
  const root = join(dataDir, 'ddragon')
  await mkdir(root, { recursive: true })

  let latest: string
  try {
    const versions = await fetchJson<string[]>(`${BASE}/api/versions.json`)
    latest = versions[0]
  } catch (err) {
    const cached = await newestCachedVersion(root)
    if (!cached) throw new Error(`Data Dragon unreachable and nothing cached: ${String(err)}`)
    log(`Data Dragon unreachable, using cached ${cached}`)
    return { version: cached, dir: join(root, cached), downloaded: false, offline: true }
  }

  const dir = join(root, latest)
  if (await exists(join(dir, COMPLETE_MARKER))) {
    return { version: latest, dir, downloaded: false, offline: false }
  }

  // Download into a temp folder and rename at the end, so a crash mid-download
  // never leaves a half-written folder that looks valid.
  const partial = `${dir}.partial`
  await rm(partial, { recursive: true, force: true })
  log(`Downloading Data Dragon ${latest}...`)
  await downloadVersion(latest, partial, log)
  await writeFile(join(partial, COMPLETE_MARKER), new Date().toISOString())
  await rm(dir, { recursive: true, force: true })
  await rename(partial, dir)
  await pruneOldVersions(root)
  log(`Data Dragon ${latest} ready`)
  return { version: latest, dir, downloaded: true, offline: false }
}

async function downloadVersion(version: string, dir: string, log: Log): Promise<void> {
  const cdn = `${BASE}/cdn/${version}`
  const json = ['champion', 'item', 'runesReforged', 'summoner']
  const files = await Promise.all(
    json.map(async (name) => {
      const body = await fetchBytes(`${cdn}/data/${LOCALE}/${name}.json`)
      await writeFileDeep(join(dir, `${name}.json`), body)
      return JSON.parse(body.toString('utf8')) as unknown
    })
  )
  const [champions, items, runes, summoners] = files as [
    DataFile<{ image: ImageRef }>,
    DataFile<{ image: ImageRef }>,
    RuneStyle[],
    DataFile<{ image: ImageRef }>
  ]

  // Icon URL -> local path. Champion/item/spell icons are versioned; rune icons are not.
  const icons: [string, string][] = [
    ...Object.values(champions.data).map((c): [string, string] => [
      `${cdn}/img/champion/${c.image.full}`,
      join(dir, 'img', 'champion', c.image.full)
    ]),
    ...Object.values(items.data).map((i): [string, string] => [
      `${cdn}/img/item/${i.image.full}`,
      join(dir, 'img', 'item', i.image.full)
    ]),
    ...Object.values(summoners.data).map((s): [string, string] => [
      `${cdn}/img/spell/${s.image.full}`,
      join(dir, 'img', 'spell', s.image.full)
    ]),
    ...runes
      .flatMap((style) => [style.icon, ...style.slots.flatMap((slot) => slot.runes.map((r) => r.icon))])
      .map((icon): [string, string] => [`${BASE}/cdn/img/${icon}`, join(dir, 'img', icon)])
  ]

  let done = 0
  await mapLimit(icons, PARALLEL_DOWNLOADS, async ([url, path]) => {
    await writeFileDeep(path, await fetchBytes(url))
    done++
    if (done % 100 === 0 || done === icons.length) log(`  icons ${done}/${icons.length}`)
  })
}

// Keep the newest few versions (the previous patch is handy right after a patch drops).
async function pruneOldVersions(root: string): Promise<void> {
  const versions = await cachedVersions(root)
  for (const old of versions.slice(VERSIONS_TO_KEEP)) {
    await rm(join(root, old), { recursive: true, force: true })
  }
}

async function newestCachedVersion(root: string): Promise<string | null> {
  return (await cachedVersions(root))[0] ?? null
}

// Complete cached versions, newest first.
async function cachedVersions(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true }).catch(() => [])
  const complete: string[] = []
  for (const e of entries) {
    if (e.isDirectory() && !e.name.endsWith('.partial') && (await exists(join(root, e.name, COMPLETE_MARKER)))) {
      complete.push(e.name)
    }
  }
  return complete.sort(compareVersionsDesc)
}

function compareVersionsDesc(a: string, b: string): number {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pb[i] ?? 0) - (pa[i] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}

// Read a cached JSON file for a version, e.g. readDdragonJson(dir, 'champion').
export async function readDdragonJson<T>(versionDir: string, name: string): Promise<T> {
  return JSON.parse(await readFile(join(versionDir, `${name}.json`), 'utf8')) as T
}

async function fetchJson<T>(url: string): Promise<T> {
  return JSON.parse((await fetchBytes(url)).toString('utf8')) as T
}

async function fetchBytes(url: string, attempts = 3): Promise<Buffer> {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(15_000) })
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
      return Buffer.from(await res.arrayBuffer())
    } catch (err) {
      if (attempt >= attempts) throw err
      await new Promise((r) => setTimeout(r, 500 * attempt))
    }
  }
}

async function writeFileDeep(path: string, body: Buffer): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, body)
}

async function exists(path: string): Promise<boolean> {
  return stat(path).then(
    () => true,
    () => false
  )
}

// Run fn over items with at most `limit` in flight at once.
async function mapLimit<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let next = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) await fn(items[next++])
  })
  await Promise.all(workers)
}
