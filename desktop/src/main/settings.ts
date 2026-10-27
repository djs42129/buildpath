// User settings persisted to data/settings.json: overlay position, opacity, last tab, hotkeys.
// Edit the file by hand to rebind hotkeys (Electron accelerator syntax), then restart the app.

import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { OverlayTab } from '../shared/types'

export interface Settings {
  overlay: {
    // Top-left corner in DIPs (display-independent pixels, so Windows scaling is handled
    // by Electron). Unset means "use the default dock position".
    x?: number
    y?: number
    opacity: number
    tab: OverlayTab
  }
  hotkeys: {
    toggle: string
    editMode: string
    // Build, Skills, Runes, Tiers.
    tabs: [string, string, string, string]
  }
}

const DEFAULTS: Settings = {
  overlay: { opacity: 0.85, tab: 'build' },
  hotkeys: {
    toggle: 'CommandOrControl+Shift+O',
    editMode: 'CommandOrControl+Shift+L',
    tabs: [
      'CommandOrControl+Shift+1',
      'CommandOrControl+Shift+2',
      'CommandOrControl+Shift+3',
      'CommandOrControl+Shift+4'
    ]
  }
}

export class SettingsStore {
  private readonly path: string
  private data: Settings
  private saveTimer: NodeJS.Timeout | undefined

  constructor(dataDir: string) {
    this.path = join(dataDir, 'settings.json')
    this.data = this.load()
  }

  get(): Settings {
    return this.data
  }

  update(change: (s: Settings) => void): void {
    change(this.data)
    // Dragging fires many move events; write once things settle.
    clearTimeout(this.saveTimer)
    this.saveTimer = setTimeout(() => this.flush(), 500)
  }

  flush(): void {
    clearTimeout(this.saveTimer)
    mkdirSync(dirname(this.path), { recursive: true })
    const tmp = `${this.path}.tmp`
    writeFileSync(tmp, JSON.stringify(this.data, null, 2))
    renameSync(tmp, this.path)
  }

  private load(): Settings {
    try {
      const saved = JSON.parse(readFileSync(this.path, 'utf8')) as Partial<Settings>
      return {
        overlay: { ...DEFAULTS.overlay, ...saved.overlay },
        hotkeys: { ...DEFAULTS.hotkeys, ...saved.hotkeys }
      }
    } catch {
      return structuredClone(DEFAULTS)
    }
  }
}
