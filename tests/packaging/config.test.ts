import { readFileSync } from 'node:fs'
import { parse } from 'yaml'
import { describe, expect, it } from 'vitest'

interface BuilderConfig {
  appId: string
  files: string[]
  asarUnpack: string[]
  extraResources: Array<{ from: string; to: string }>
  npmRebuild: boolean
  publish?: unknown
  win: {
    target: Array<{ target: string; arch: string[] }>
    icon: string
  }
  nsis: {
    oneClick: boolean
    perMachine: boolean
    allowToChangeInstallationDirectory: boolean
    createDesktopShortcut: boolean
    installerIcon: string
    uninstallerIcon: string
  }
}

describe('Windows installer configuration', () => {
  it('builds an x64 current-user NSIS installer with native SQLite support', () => {
    const config = parse(readFileSync('electron-builder.yml', 'utf8')) as BuilderConfig
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8'))

    expect(config.appId).toBe('com.windows-todo.app')
    expect(config.win.target).toContainEqual({ target: 'nsis', arch: ['x64'] })
    expect(config.nsis).toMatchObject({
      oneClick: false,
      perMachine: false,
      allowToChangeInstallationDirectory: true,
      createDesktopShortcut: true,
    })
    expect(config.files).toContain('out/**/*')
    expect(config.asarUnpack).toContain('**/*.node')
    expect(config.extraResources).toContainEqual({ from: 'native-widget/bin', to: 'native-widget' })
    expect(packageJson.scripts.build).toMatch(/^npm run build:native-widget && /)
    const manifest = readFileSync('native-widget/app.manifest', 'utf8')
    expect(manifest).toContain('PerMonitorV2')
    expect(manifest).toContain('true/pm')
    expect(config.npmRebuild).toBe(true)
    expect(config.publish).toBeUndefined()
    expect(packageJson.dependencies['better-sqlite3']).toBeDefined()
    expect(packageJson.dependencies['electron-updater']).toBeUndefined()
    expect(packageJson.scripts.dist).toContain('electron-builder')
    expect(config.win.icon).toBe('build/icon.ico')
    expect(config.nsis.installerIcon).toBe('build/icon.ico')
    expect(config.nsis.uninstallerIcon).toBe('build/icon.ico')
    expect(config.extraResources).toContainEqual({ from: 'assets/icon.png', to: 'icon.png' })
    const icon = readFileSync('build/icon.ico')
    expect(icon.readUInt16LE(0)).toBe(0)
    expect(icon.readUInt16LE(2)).toBe(1)
    expect(icon.readUInt16LE(4)).toBeGreaterThanOrEqual(6)
  })
})
