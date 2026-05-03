import {
  app,
  BrowserWindow,
  globalShortcut,
  ipcMain,
  Menu,
  nativeImage,
  safeStorage,
  screen,
  Tray
} from 'electron'
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'fs'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import {
  getWebhookPort,
  isWebhookRunning,
  startWebhookServer,
  stopWebhookServer
} from './webhookServer'

const COLLAPSED = { width: 80, height: 80 }
const EXPANDED = { width: 380, height: 690 }
const SCREEN_MARGIN = 20

type Anchor = { x: number; y: number }
type State = { anchor?: Anchor; buttonVisible?: boolean }

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let panelExpanded = false
let buttonVisible = true
let collapsedAnchor: Anchor | null = null

function statePath(): string {
  return join(app.getPath('userData'), 'state.json')
}

function authTokenPath(): string {
  return join(app.getPath('userData'), 'auth.bin')
}

function readAuthToken(): string | null {
  try {
    const p = authTokenPath()
    if (!existsSync(p)) return null
    if (!safeStorage.isEncryptionAvailable()) {
      console.warn('safeStorage encryption unavailable — refusing to read auth token')
      return null
    }
    const encrypted = readFileSync(p)
    return safeStorage.decryptString(encrypted)
  } catch (err) {
    console.error('Failed to read auth token:', err)
    return null
  }
}

function writeAuthToken(token: string): boolean {
  try {
    if (!safeStorage.isEncryptionAvailable()) {
      console.warn('safeStorage encryption unavailable — refusing to write auth token')
      return false
    }
    const encrypted = safeStorage.encryptString(token)
    writeFileSync(authTokenPath(), encrypted)
    return true
  } catch (err) {
    console.error('Failed to write auth token:', err)
    return false
  }
}

function clearAuthToken(): void {
  try {
    const p = authTokenPath()
    if (existsSync(p)) unlinkSync(p)
  } catch (err) {
    console.error('Failed to clear auth token:', err)
  }
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

function saveState(partial: Partial<State>): void {
  try {
    const merged = { ...loadState(), ...partial }
    writeFileSync(statePath(), JSON.stringify(merged, null, 2), 'utf-8')
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

  win.on('ready-to-show', () => {
    if (buttonVisible) win.show()
  })
  win.on('moved', () => {
    const b = win.getBounds()
    saveState({ anchor: { x: b.x + b.width, y: b.y + b.height } })
  })
  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  if (is.dev) {
    win.webContents.openDevTools({ mode: 'detach' })
  }

  mainWindow = win
  return win
}

function togglePanel(): boolean {
  if (!mainWindow) return panelExpanded
  const current = mainWindow.getBounds()
  const wasExpanded = panelExpanded
  panelExpanded = !panelExpanded

  let newX: number
  let newY: number
  let nextSize: { width: number; height: number }

  if (!wasExpanded) {
    // Expanding: save the bottom-right corner so we can restore it on collapse,
    // even if macOS clamps the expanded window to the work area.
    collapsedAnchor = {
      x: current.x + current.width,
      y: current.y + current.height
    }
    nextSize = EXPANDED
    const { workArea } = screen.getPrimaryDisplay()
    // Pick expansion direction based on available room on each side.
    // Prefer up + left (the original behavior); fall back to down / right
    // when there isn't enough room. Keeps the floating button anchored.
    const expandLeft = current.x >= EXPANDED.width
    const expandUp = current.y - workArea.y >= EXPANDED.height
    newX = expandLeft ? collapsedAnchor.x - EXPANDED.width : current.x
    newY = expandUp ? collapsedAnchor.y - EXPANDED.height : current.y

    // Final safety clamp — guarantees the panel stays fully on-screen even
    // when the button is mid-display and neither side has enough room for
    // the full panel height. The button position on collapse is restored
    // from collapsedAnchor (saved above), so this clamp can't desync it.
    if (newX + EXPANDED.width > workArea.x + workArea.width) {
      newX = workArea.x + workArea.width - EXPANDED.width
    }
    if (newX < workArea.x) {
      newX = workArea.x
    }
    if (newY + EXPANDED.height > workArea.y + workArea.height) {
      newY = workArea.y + workArea.height - EXPANDED.height
    }
    if (newY < workArea.y) {
      newY = workArea.y
    }
  } else {
    // Collapsing: restore the button to the saved bottom-right anchor,
    // ignoring any drift that happened during expansion.
    nextSize = COLLAPSED
    const anchor = collapsedAnchor ?? {
      x: current.x + current.width,
      y: current.y + current.height
    }
    newX = anchor.x - COLLAPSED.width
    newY = anchor.y - COLLAPSED.height
    collapsedAnchor = null
  }

  mainWindow.setBounds(
    { x: newX, y: newY, width: nextSize.width, height: nextSize.height },
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
  if (!buttonVisible) {
    mainWindow.show()
    buttonVisible = true
    saveState({ buttonVisible })
    rebuildTrayMenu()
    if (!panelExpanded) togglePanel()
    return
  }
  if (!mainWindow.isVisible()) mainWindow.show()
  mainWindow.focus()
  togglePanel()
}

function toggleButtonVisibility(): void {
  if (!mainWindow) return

  if (buttonVisible) {
    if (panelExpanded) togglePanel()
    mainWindow.hide()
    buttonVisible = false
  } else {
    mainWindow.show()
    buttonVisible = true
  }

  saveState({ buttonVisible })
  rebuildTrayMenu()
}

function rebuildTrayMenu(): void {
  if (!tray) return
  const menu = Menu.buildFromTemplate([
    {
      label: 'Toggle Panel',
      accelerator: 'Control+Shift+G',
      click: () => showAndTogglePanel()
    },
    {
      label: buttonVisible ? 'Hide Floating Button' : 'Show Floating Button',
      click: () => toggleButtonVisibility()
    },
    { type: 'separator' },
    { label: 'Quit TradingGYM Live', click: () => app.quit() }
  ])
  tray.setContextMenu(menu)
}

function createTray(): void {
  const iconPath = join(__dirname, '../../resources/icon.png')
  const image = nativeImage.createFromPath(iconPath).resize({ width: 18, height: 18 })
  tray = new Tray(image)
  tray.setToolTip('TradingGYM Live')

  rebuildTrayMenu()
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

  ipcMain.handle('auth:get-token', () => readAuthToken())
  ipcMain.handle('auth:save-token', (_evt, token: string) => writeAuthToken(token))
  ipcMain.handle('auth:clear-token', () => {
    clearAuthToken()
  })

  ipcMain.handle('webhook:get-status', () => ({
    port: getWebhookPort(),
    running: isWebhookRunning()
  }))
}

app.whenReady().then(() => {
  buttonVisible = loadState().buttonVisible !== false
  createWindow()
  createTray()
  registerIpc()

  const supabaseUrl = import.meta.env.MAIN_VITE_SUPABASE_URL ?? ''
  const supabaseKey = import.meta.env.MAIN_VITE_SUPABASE_PUBLISHABLE_KEY ?? ''
  startWebhookServer(supabaseUrl, supabaseKey)

  const hotkey = 'Control+Shift+G'
  const registered = globalShortcut.register(hotkey, showAndTogglePanel)
  if (!registered) console.warn(`Failed to register global shortcut ${hotkey}`)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
    else mainWindow?.show()
  })
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  stopWebhookServer()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

if (is.dev) {
  process.on('SIGINT', () => app.quit())
  process.on('SIGTERM', () => app.quit())
}
