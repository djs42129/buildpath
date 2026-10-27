// Live Client Data API: the in-game HTTP server League runs on 127.0.0.1:2999 while a
// game is in progress (including the Practice Tool). Read-only, officially supported.

import { readFileSync } from 'node:fs'
import { Agent, get } from 'node:https'
import type { AbilityKey, LiveSnapshot, NamedId } from '../shared/types'

const URL = 'https://127.0.0.1:2999/liveclientdata/allgamedata'
const POLL_MS = 2000
// Hide only after a few misses in a row, so one slow response doesn't flicker the overlay.
const MISSES_BEFORE_GONE = 3

// Subset of the allgamedata response we read. Field names are Riot's.
interface RawNamed {
  id: number
  displayName: string
}
interface AllGameData {
  activePlayer: {
    riotId?: string
    summonerName?: string
    level: number
    currentGold: number
    abilities: Record<AbilityKey, { abilityLevel?: number }>
    fullRunes?: {
      keystone?: RawNamed
      primaryRuneTree?: RawNamed
      secondaryRuneTree?: RawNamed
      generalRunes?: RawNamed[]
    }
  }
  allPlayers: {
    riotId?: string
    summonerName?: string
    championName: string
    items: { itemID: number; displayName: string; slot: number }[]
  }[]
}

export type SnapshotSource = () => Promise<LiveSnapshot | null>

// Trust Riot's root certificate for this one connection only. The chain is still verified
// against riotgames.pem; we skip only the hostname check, because the game's certificate
// isn't issued for "127.0.0.1". Nothing else in the app is affected.
export function createLiveClientSource(riotCertPath: string): SnapshotSource {
  const agent = new Agent({
    ca: readFileSync(riotCertPath),
    checkServerIdentity: (host) =>
      host === '127.0.0.1' ? undefined : new Error(`Unexpected Live Client host ${host}`),
    keepAlive: true
  })
  return async () => {
    const raw = await getJson<AllGameData>(URL, agent)
    return raw ? toSnapshot(raw) : null
  }
}

function getJson<T>(url: string, agent: Agent): Promise<T | null> {
  return new Promise((resolve) => {
    const req = get(url, { agent, timeout: 1500 }, (res) => {
      if (res.statusCode !== 200) {
        res.resume()
        resolve(null)
        return
      }
      let body = ''
      res.setEncoding('utf8')
      res.on('data', (chunk) => (body += chunk))
      res.on('end', () => {
        try {
          resolve(JSON.parse(body) as T)
        } catch {
          resolve(null)
        }
      })
    })
    // Connection refused just means no game is running.
    req.on('error', () => resolve(null))
    req.on('timeout', () => req.destroy())
  })
}

export function toSnapshot(raw: AllGameData): LiveSnapshot | null {
  const me = raw.activePlayer
  // In spectator mode there is no active player.
  if (!me || !me.abilities) return null
  const self = raw.allPlayers.find((p) =>
    me.riotId ? p.riotId === me.riotId : p.summonerName === me.summonerName
  )
  if (!self) return null
  const named = (r?: RawNamed): NamedId | null => (r ? { id: r.id, name: r.displayName } : null)
  return {
    champion: self.championName,
    level: me.level,
    gold: Math.floor(me.currentGold),
    items: self.items
      .map((i) => ({ id: i.itemID, name: i.displayName, slot: i.slot }))
      .sort((a, b) => a.slot - b.slot),
    abilities: {
      Q: me.abilities.Q?.abilityLevel ?? 0,
      W: me.abilities.W?.abilityLevel ?? 0,
      E: me.abilities.E?.abilityLevel ?? 0,
      R: me.abilities.R?.abilityLevel ?? 0
    },
    runes: {
      keystone: named(me.fullRunes?.keystone),
      primaryTree: named(me.fullRunes?.primaryRuneTree),
      secondaryTree: named(me.fullRunes?.secondaryRuneTree),
      runes: (me.fullRunes?.generalRunes ?? []).map((r) => ({ id: r.id, name: r.displayName }))
    }
  }
}

// Poll the source and report changes. onChange(null) means the game is gone.
export function startPolling(source: SnapshotSource, onChange: (s: LiveSnapshot | null) => void): () => void {
  let last = 'null'
  let misses = 0
  let stopped = false
  let timer: NodeJS.Timeout | undefined

  const tick = async (): Promise<void> => {
    const snapshot = await source().catch(() => null)
    if (stopped) return
    if (snapshot) {
      misses = 0
    } else if (++misses < MISSES_BEFORE_GONE && last !== 'null') {
      timer = setTimeout(tick, POLL_MS)
      return
    }
    // Comparing serialized snapshots is cheap at this size and skips most IPC and re-renders.
    const serialized = JSON.stringify(snapshot)
    if (serialized !== last) {
      last = serialized
      onChange(snapshot)
    }
    timer = setTimeout(tick, POLL_MS)
  }
  tick()
  return () => {
    stopped = true
    clearTimeout(timer)
  }
}
