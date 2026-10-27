// The in-game overlay window: transparent, always on top, click-through, never focused.
// Edit mode temporarily makes it draggable; leaving edit mode locks it back.

import { app, BrowserWindow, globalShortcut, screen } from 'electron'
import { join } from 'node:path'
import type { LiveSnapshot, OverlayState, OverlayTab } from '../shared/types'
import type { SettingsStore } from './settings'

const WIDTH = 280
const HEIGHT = 360
const EDGE_MARGIN = 12
// League's minimap sits in the bottom-right corner, roughly 280px tall at 1080p.
// The default dock keeps the panel on the right edge, above it.
const MINIMAP_CLEARANCE = 300
const TABS: OverlayTab[] = ['build', 'skills', 'runes', 'tiers']

export class Overlay {
  private readonly win: BrowserWindow
  private inGame = false
  private hiddenByUser = false
  private editMode = false
  private lastSnapshot: LiveSnapshot | null = null

  constructor(
    private readonly settings: SettingsStore,
    loadPage: (win: BrowserWindow) => void
  ) {
    const { x, y } = this.initialPosition()
    this.win = new BrowserWindow({
      x,
      y,
      width: WIDTH,
      height: HEIGHT,
      show: false,
      frame: false,
      transparent: true,
      resizable: false,
      maximizable: false,
      minimizable: false,
      skipTaskbar: true,
      hasShadow: false,
      // Never take keyboard focus from the game. On Windows this maps to WS_EX_NOACTIVATE.
      focusable: false,
      alwaysOnTop: true,
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        contextIsolation: true,
        sandbox: true
      }
    })
    // 'screen-saver' is the highest z-order level, above borderless fullscreen games.
    this.win.setAlwaysOnTop(true, 'screen-saver')
    // Click-through: mouse events pass to the game underneath.
    this.win.setIgnoreMouseEvents(true)
    this.win.setOpacity(settings.get().overlay.opacity)
    this.win.on('moved', () => {
      const [nx, ny] = this.win.getPosition()
      this.settings.update((s) => {
        s.overlay.x = nx
        s.overlay.y = ny
      })
    })
    this.win.webContents.on('did-finish-load', () => {
      this.sendState()
      this.win.webContents.send('live:update', this.lastSnapshot)
    })
    loadPage(this.win)
    this.registerHotkeys()
  }

  setSnapshot(snapshot: LiveSnapshot | null): void {
    this.lastSnapshot = snapshot
    this.inGame = snapshot !== null
    this.win.webContents.send('live:update', snapshot)
    this.updateVisibility()
  }

  adjustOpacity(delta: number): void {
    if (!this.editMode) return
    const next = Math.round(Math.min(1, Math.max(0.3, this.win.getOpacity() + delta)) * 100) / 100
    this.win.setOpacity(next)
    this.settings.update((s) => (s.overlay.opacity = next))
    this.sendState()
  }

  isVisible(): boolean {
    return this.win.isVisible()
  }

  private registerHotkeys(): void {
    const { hotkeys } = this.settings.get()
    const register = (accelerator: string, fn: () => void): void => {
      if (!globalShortcut.register(accelerator, fn)) {
        console.warn(`[overlay] hotkey ${accelerator} is taken by another app`)
      }
    }
    register(hotkeys.toggle, () => {
      this.hiddenByUser = !this.hiddenByUser
      this.updateVisibility()
    })
    register(hotkeys.editMode, () => this.setEditMode(!this.editMode))
    hotkeys.tabs.forEach((accelerator, i) =>
      register(accelerator, () => {
        this.settings.update((s) => (s.overlay.tab = TABS[i]))
        this.sendState()
      })
    )
    app.on('will-quit', () => globalShortcut.unregisterAll())
  }

  private setEditMode(on: boolean): void {
    this.editMode = on
    // Edit mode is the only time the overlay accepts the mouse. Focusable is needed for
    // dragging to work reliably; it goes back off as soon as the panel is locked.
    this.win.setIgnoreMouseEvents(!on)
    this.win.setFocusable(on)
    if (!on) this.settings.flush()
    this.sendState()
    this.updateVisibility()
  }

  // Shown in game unless toggled off, and always shown in edit mode so it can be positioned
  // before a game starts.
  private updateVisibility(): void {
    const shouldShow = this.editMode || (this.inGame && !this.hiddenByUser)
    if (shouldShow && !this.win.isVisible()) {
      // showInactive: appear without activating the window, so the game keeps focus.
      this.win.showInactive()
    } else if (!shouldShow && this.win.isVisible()) {
      this.win.hide()
    }
  }

  private sendState(): void {
    const state: OverlayState = {
      editMode: this.editMode,
      tab: this.settings.get().overlay.tab,
      opacity: this.win.getOpacity()
    }
    this.win.webContents.send('overlay:state', state)
  }

  private initialPosition(): { x: number; y: number } {
    const { x, y } = this.settings.get().overlay
    // Use the saved spot only if it's still on a connected display. Full display bounds,
    // not the work area: the taskbar is hidden while a borderless game is in front.
    if (x !== undefined && y !== undefined) {
      const onScreen = screen.getAllDisplays().some(({ bounds: a }) =>
        x >= a.x && y >= a.y && x + WIDTH <= a.x + a.width && y + HEIGHT <= a.y + a.height
      )
      if (onScreen) return { x, y }
    }
    // Electron works in DIPs, so this lands in the same place at 100%, 125% or 150% scaling.
    const { bounds } = screen.getPrimaryDisplay()
    return {
      x: bounds.x + bounds.width - WIDTH - EDGE_MARGIN,
      y: Math.max(bounds.y + EDGE_MARGIN, bounds.y + bounds.height - MINIMAP_CLEARANCE - HEIGHT)
    }
  }
}
