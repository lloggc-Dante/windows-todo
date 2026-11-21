import { execFileSync } from 'node:child_process'

export default function globalSetup(): void {
  execFileSync(process.execPath, ['node_modules/electron-vite/bin/electron-vite.js', 'build'], {
    cwd: process.cwd(),
    stdio: 'inherit',
  })
}
