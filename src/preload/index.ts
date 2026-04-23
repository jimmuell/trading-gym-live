import { contextBridge, ipcRenderer } from 'electron'
import type { IpcRendererEvent } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {
  togglePanel: (): Promise<boolean> => ipcRenderer.invoke('panel:toggle'),
  getPanelState: (): Promise<boolean> => ipcRenderer.invoke('panel:get-state'),
  onPanelState: (cb: (expanded: boolean) => void): (() => void) => {
    const handler = (_: IpcRendererEvent, expanded: boolean): void => cb(expanded)
    ipcRenderer.on('panel:state', handler)
    return () => {
      ipcRenderer.off('panel:state', handler)
    }
  },
  minimize: (): Promise<void> => ipcRenderer.invoke('window:minimize'),
  toggleAlwaysOnTop: (): Promise<boolean> => ipcRenderer.invoke('window:toggle-always-on-top'),
  getAlwaysOnTop: (): Promise<boolean> => ipcRenderer.invoke('window:get-always-on-top')
}

export type TradingGymAPI = typeof api

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
