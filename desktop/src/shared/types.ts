// Types shared by the main process and the renderer windows.

export interface DdragonStatus {
  // Patch version, e.g. "16.21.1". Null only if nothing is cached and the download failed.
  version: string | null
  // True when the network was unreachable and we fell back to the newest cached version.
  offline: boolean
  error?: string
}

export type AbilityKey = 'Q' | 'W' | 'E' | 'R'

export interface NamedId {
  id: number
  name: string
}

// The trimmed slice of Live Client Data the overlay renders. Main builds it from
// allgamedata and only sends it when it changes, so React re-renders stay rare.
export interface LiveSnapshot {
  champion: string
  level: number
  gold: number
  // Items in the player's inventory slots (0-5 items, 6 trinket).
  items: { id: number; name: string; slot: number }[]
  abilities: Record<AbilityKey, number>
  runes: {
    keystone: NamedId | null
    primaryTree: NamedId | null
    secondaryTree: NamedId | null
    // Keystone plus the five other runes, in order.
    runes: NamedId[]
  }
}

export type OverlayTab = 'build' | 'skills' | 'runes' | 'tiers'

export interface OverlayState {
  editMode: boolean
  tab: OverlayTab
  opacity: number
}
