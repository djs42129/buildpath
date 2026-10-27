// Fake Live Client source for developing the overlay without League running.
// Enabled with OVERLAY_MOCK=1. Simulates a game: levels up and buys items over time.

import type { LiveSnapshot } from '../shared/types'
import type { SnapshotSource } from './liveclient'

const SKILL_ORDER = 'QEWQQRQEQEREEWWRWW' as const
const PURCHASES: [number, string][] = [
  [1056, "Doran's Ring"],
  [3020, "Sorcerer's Shoes"],
  [6655, "Luden's Companion"],
  [4645, 'Shadowflame'],
  [3089, "Rabadon's Deathcap"]
]

export function createMockSource(): SnapshotSource {
  const startedAt = Date.now()
  return async () => {
    // One level every 10 seconds, one item every 2 levels.
    const level = Math.min(18, 1 + Math.floor((Date.now() - startedAt) / 10_000))
    const abilities = { Q: 0, W: 0, E: 0, R: 0 }
    for (const key of SKILL_ORDER.slice(0, level)) abilities[key as keyof typeof abilities]++
    const owned = PURCHASES.slice(0, Math.ceil(level / 2))
    const snapshot: LiveSnapshot = {
      champion: 'Ahri',
      level,
      gold: 500 + level * 37,
      items: [
        ...owned.map(([id, name], slot) => ({ id, name, slot })),
        { id: 3340, name: 'Stealth Ward', slot: 6 }
      ],
      abilities,
      runes: {
        keystone: { id: 8112, name: 'Electrocute' },
        primaryTree: { id: 8100, name: 'Domination' },
        secondaryTree: { id: 8200, name: 'Sorcery' },
        runes: [
          { id: 8112, name: 'Electrocute' },
          { id: 8139, name: 'Taste of Blood' },
          { id: 8138, name: 'Eyeball Collection' },
          { id: 8135, name: 'Treasure Hunter' },
          { id: 8226, name: 'Manaflow Band' },
          { id: 8210, name: 'Transcendence' }
        ]
      }
    }
    return snapshot
  }
}
