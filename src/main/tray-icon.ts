import { nativeImage } from 'electron'

const PNG_DATA = 'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAGUlEQVR4nGNQTX79nxLMMGrAqAGjBgwXAwBTenIf6qOsqQAAAABJRU5ErkJggg=='

export function createTrayIcon(): Electron.NativeImage {
  return nativeImage.createFromDataURL(`data:image/png;base64,${PNG_DATA}`)
}
