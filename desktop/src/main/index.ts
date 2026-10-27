import { app, BrowserWindow, ipcMain, net, protocol } from 'electron'
import { join, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { ensureDdragon } from './ddragon'
import { createLiveClientSource, startPolling } from './liveclient'
import { createMockSource } from './mock'
import { Overlay } from './overlay'
import { SettingsStore } from './settings'
import type { DdragonStatus } from '../shared/types'

// data/ sits at the repo root, next to desktop/. app.getAppPath() is desktop/.
const DATA_DIR = resolve(app.getAppPath(), '..', 'data')
const RIOT_CERT = join(app.getAppPath(), 'resources', 'riotgames.pem')
const CPU_LOG_MS = 30_000

// Serves cached Data Dragon icons to the renderers as ddragon://img/<path>, so pages never
// load from disk paths or the network directly.
protocol.registerSchemesAsPrivileged([{ scheme: 'ddragon', privileges: { standard: true, secure: true } }])

let ddragonDir: Promise<string | null>
let ddragonStatus: Promise<DdragonStatus>

function createCompanionWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 420,
    height: 640,
    title: 'Buildpath',
    backgroundColor: '#0f1115',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      // Renderer gets no Node access; everything goes through the preload bridge.
      contextIsolation: true,
      sandbox: true
    }
  })
  loadPage(win, 'companion')
  return win
}

// In dev, electron-vite serves pages with hot reload; in a build they're files on disk.
function loadPage(win: BrowserWindow, page: 'companion' | 'overlay'): void {
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (!app.isPackaged && devUrl) {
    win.loadURL(`${devUrl}/${page}/index.html`)
  } else {
    win.loadFile(join(__dirname, `../renderer/${page}/index.html`))
  }
}

function registerDdragonProtocol(): void {
  protocol.handle('ddragon', async (request) => {
    const dir = await ddragonDir
    const { pathname } = new URL(request.url)
    if (!dir) return new Response(null, { status: 404 })
    const root = join(dir, 'img')
    const file = resolve(root, decodeURIComponent(pathname).replace(/^\/+/, ''))
    // Refuse anything that resolves outside the icon folder (e.g. "../../.env").
    if (!file.startsWith(root + sep)) return new Response(null, { status: 403 })
    return net.fetch(pathToFileURL(file).toString())
  })
}

// Logs the app's total CPU use while the overlay is up, for checking the under-2% budget.
// Electron reports percent of one core; Task Manager divides by core count.
function logCpu(overlay: Overlay): void {
  app.getAppMetrics() // first call primes the counters
  setInterval(() => {
    const metrics = app.getAppMetrics()
    if (!overlay.isVisible()) return
    const total = metrics.reduce((sum, m) => sum + m.cpu.percentCPUUsage, 0)
    console.log(`[cpu] ${total.toFixed(2)}% of one core across ${metrics.length} processes`)
  }, CPU_LOG_MS)
}

app.whenReady().then(() => {
  const ddragon = ensureDdragon(DATA_DIR, (m) => console.log(`[ddragon] ${m}`))
  ddragonDir = ddragon.then(
    (r) => r.dir,
    () => null
  )
  ddragonStatus = ddragon.then(
    (r): DdragonStatus => ({ version: r.version, offline: r.offline }),
    (err): DdragonStatus => ({ version: null, offline: true, error: String(err) })
  )
  registerDdragonProtocol()

  const settings = new SettingsStore(DATA_DIR)
  const overlay = new Overlay(settings, (win) => loadPage(win, 'overlay'))

  ipcMain.handle('ddragon:status', () => ddragonStatus)
  ipcMain.on('overlay:opacity', (_event, delta: number) => overlay.adjustOpacity(delta))

  // OVERLAY_MOCK=1 simulates a game so the overlay can be worked on without League.
  const source = process.env['OVERLAY_MOCK'] === '1' ? createMockSource() : createLiveClientSource(RIOT_CERT)
  startPolling(source, (snapshot) => overlay.setSnapshot(snapshot))
  logCpu(overlay)

  createCompanionWindow()
  app.on('before-quit', () => settings.flush())
})

app.on('window-all-closed', () => app.quit())
