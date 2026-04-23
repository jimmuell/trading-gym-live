import { app, BrowserWindow, ipcMain, screen } from 'electron'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'

const COLLAPSED = { width: 120, height: 120 }
const EXPANDED = { width: 360, height: 420 }
const SCREEN_MARGIN = 20

type Anchor = { x: number; y: number }
type State = { anchor?: Anchor }

let mainWindow: BrowserWindow | null = null
let panelExpanded = false

function statePath(): string {
  return join(app.getPath('userData'), 'state.json')
}

function loadState(): State {
  try {
    const p = statePath()
    if (!existsSync(p)) return {}
    return JSON.parse(readFileSync(p, 'utf-8')) as State
  } catch {
    return {}
  }
}

function saveAnchor(anchor: Anchor): void {
  try {
    writeFileSync(statePath(), JSON.stringify({ anchor }, null, 2), 'utf-8')
  } catch (err) {
    console.error('Failed to save state:', err)
  }
}

function clampAnchor(anchor: Anchor): Anchor {
  const { workArea } = screen.getPrimaryDisplay()
  const minX = workArea.x + COLLAPSED.width
  const maxX = workArea.x + workArea.width
  const minY = workArea.y + COLLAPSED.height
  const maxY = workArea.y + workArea.height
  return {
    x: Math.max(minX, Math.min(maxX, anchor.x)),
    y: Math.max(minY, Math.min(maxY, anchor.y))
  }
}

function defaultAnchor(): Anchor {
  const { workArea } = screen.getPrimaryDisplay()
  return {
    x: workArea.x + workArea.width - SCREEN_MARGIN,
    y: workArea.y + workArea.height - SCREEN_MARGIN
  }
}

function createWindow(): BrowserWindow {
  const saved = loadState().anchor
  const anchor = clampAnchor(saved ?? defaultAnchor())
  const x = anchor.x - COLLAPSED.width
  const y = anchor.y - COLLAPSED.height

  const win = new BrowserWindow({
    width: COLLAPSED.width,
    height: COLLAPSED.height,
    x,
    y,
    show: false,
    frame: false,
    transparent: true,
    hasShadow: false,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  win.setAlwaysOnTop(true, 'screen-saver')

  win.on('ready-to-show', () => win.show())
  win.on('moved', () => {
    const b = win.getBounds()
    saveAnchor({ x: b.x + b.width, y: b.y + b.height })
  })
  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow = win
  return win
}

function togglePanel(): boolean {
  if (!mainWindow) return panelExpanded
  const current = mainWindow.getBounds()
  const anchorX = current.x + current.width
  const anchorY = current.y + current.height
  panelExpanded = !panelExpanded
  const next = panelExpanded ? EXPANDED : COLLAPSED
  mainWindow.setBounds(
    {
      x: anchorX - next.width,
      y: anchorY - next.height,
      width: next.width,
      height: next.height
    },
    panelExpanded
  )
  return panelExpanded
}

app.whenReady().then(() => {
  createWindow()

  ipcMain.handle('panel:toggle', () => togglePanel())

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

if (is.dev) {
  process.on('SIGINT', () => app.quit())
  process.on('SIGTERM', () => app.quit())
}
