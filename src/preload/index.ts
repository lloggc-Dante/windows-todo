import { contextBridge, ipcRenderer } from 'electron'
import type { AppApi } from '../shared/contracts'

const api: AppApi = {
  getAppVersion: () => ipcRenderer.invoke('app:get-version'),
}

contextBridge.exposeInMainWorld('appApi', api)
