import { ElectronAPI } from '@electron-toolkit/preload'
import type { TradingGymAPI } from './index'

declare global {
  interface Window {
    electron: ElectronAPI
    api: TradingGymAPI
  }
}
