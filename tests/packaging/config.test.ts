import { readFileSync } from 'node:fs'
import { parse } from 'yaml'
import { describe, expect, it } from 'vitest'

interface BuilderConfig {
  appId: string
  files: string[]
  asarUnpack: string[]
  npmRebuild: boolean
  publish?: unknown
  win: {
    target: Array<{ target: string; arch: string[] }>
  }
  nsis: {
    oneClick: boolean
    perMachine: boolean
    allowToChangeInstallationDirectory: boolean
    createDesktopShortcut: boolean
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
    expect(config.npmRebuild).toBe(true)
    expect(config.publish).toBeUndefined()
    expect(packageJson.dependencies['better-sqlite3']).toBeDefined()
    expect(packageJson.dependencies['electron-updater']).toBeUndefined()
    expect(packageJson.scripts.dist).toContain('electron-builder')
  })
})
