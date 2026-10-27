import type { DdragonStatus, LiveSnapshot, OverlayState } from '../shared/types'

// Mirrors the object exposed in preload/index.ts so renderer code is typed.
declare global {
  interface Window {
    api: {
      getDdragonStatus: () => Promise<DdragonStatus>
      onLiveUpdate: (callback: (snapshot: LiveSnapshot | null) => void) => () => void
      onOverlayState: (callback: (state: OverlayState) => void) => () => void
      adjustOpacity: (delta: number) => void
    }
  }
}

export {}
