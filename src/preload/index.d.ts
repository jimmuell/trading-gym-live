import { ElectronAPI } from '@electron-toolkit/preload'
import type { AlaunchAPI } from './index'

declare global {
  interface Window {
    electron: ElectronAPI
    api: AlaunchAPI
  }
}
