/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string
  readonly VITE_SUPABASE_PROJECT_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

interface TradingGymAuthAPI {
  getToken: () => Promise<string | null>
  saveToken: (token: string) => Promise<boolean>
  clearToken: () => Promise<void>
}

interface TradingGymAPI {
  togglePanel: () => Promise<boolean>
  getPanelState: () => Promise<boolean>
  onPanelState: (cb: (expanded: boolean) => void) => () => void
  minimize: () => Promise<void>
  toggleAlwaysOnTop: () => Promise<boolean>
  getAlwaysOnTop: () => Promise<boolean>
  auth: TradingGymAuthAPI
}

interface Window {
  api: TradingGymAPI
}
