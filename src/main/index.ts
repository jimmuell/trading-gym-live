import {
  app,
  BrowserWindow,
  globalShortcut,
  ipcMain,
  Menu,
  nativeImage,
  screen,
  Tray
} from 'electron'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'

const COLLAPSED = { width: 80, height: 80 }
const EXPANDED = { width: 380, height: 690 }
const SCREEN_MARGIN = 20

type Anchor = { x: number; y: number }
type State = { anchor?: Anchor }

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
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
  const anchor = clampAnchor(loadState().anchor ?? defaultAnchor())
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
    title: 'TradingGYM Live',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
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
  mainWindow.webContents.send('panel:state', panelExpanded)
  return panelExpanded
}

function showAndTogglePanel(): void {
  if (!mainWindow) {
    createWindow()
    return
  }
  if (!mainWindow.isVisible()) mainWindow.show()
  mainWindow.focus()
  togglePanel()
}

function createTray(): void {
  const iconPath = join(__dirname, '../../resources/icon.png')
  const image = nativeImage.createFromPath(iconPath).resize({ width: 18, height: 18 })
  tray = new Tray(image)
  tray.setToolTip('TradingGYM Live')

  const menu = Menu.buildFromTemplate([
    {
      label: 'Toggle Panel',
      accelerator: 'CommandOrControl+Shift+Space',
      click: () => showAndTogglePanel()
    },
    { type: 'separator' },
    { label: 'Quit TradingGYM Live', click: () => app.quit() }
  ])
  tray.setContextMenu(menu)
  tray.on('click', () => showAndTogglePanel())
}

function registerIpc(): void {
  ipcMain.handle('panel:toggle', () => togglePanel())
  ipcMain.handle('panel:get-state', () => panelExpanded)
  ipcMain.handle('window:minimize', () => {
    mainWindow?.minimize()
  })
  ipcMain.handle('window:toggle-always-on-top', () => {
    if (!mainWindow) return false
    const next = !mainWindow.isAlwaysOnTop()
    if (next) mainWindow.setAlwaysOnTop(true, 'screen-saver')
    else mainWindow.setAlwaysOnTop(false)
    return next
  })
  ipcMain.handle('window:get-always-on-top', () => mainWindow?.isAlwaysOnTop() ?? false)
}

app.whenReady().then(() => {
  createWindow()
  createTray()
  registerIpc()

  const hotkey = 'CommandOrControl+Shift+Space'
  const registered = globalShortcut.register(hotkey, showAndTogglePanel)
  if (!registered) console.warn(`Failed to register global shortcut ${hotkey}`)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
    else mainWindow?.show()
  })
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

if (is.dev) {
  process.on('SIGINT', () => app.quit())
  process.on('SIGTERM', () => app.quit())
}
