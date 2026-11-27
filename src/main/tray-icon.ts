import { nativeImage } from 'electron'

export function createTrayIcon(iconPath: string): Electron.NativeImage {
  return nativeImage.createFromPath(iconPath).resize({ width: 32, height: 32, quality: 'good' })
}
