// The only bridge between the sandboxed renderer and the main process.
// Each method here is a deliberate, narrow capability; never expose ipcRenderer itself.

import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type { DdragonStatus, LiveSnapshot, OverlayState } from '../shared/types'

// Subscribe to a main-process channel; returns an unsubscribe function for React effects.
function subscribe<T>(channel: string, callback: (value: T) => void): () => void {
  const listener = (_event: IpcRendererEvent, value: T): void => callback(value)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

const api = {
  getDdragonStatus: (): Promise<DdragonStatus> => ipcRenderer.invoke('ddragon:status'),
  onLiveUpdate: (callback: (snapshot: LiveSnapshot | null) => void) => subscribe('live:update', callback),
  onOverlayState: (callback: (state: OverlayState) => void) => subscribe('overlay:state', callback),
  adjustOpacity: (delta: number): void => ipcRenderer.send('overlay:opacity', delta)
}

export type Api = typeof api

contextBridge.exposeInMainWorld('api', api)
