import { spawnSync } from 'node:child_process'
import { mkdirSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const sourceDirectory = join(root, 'native-widget')
const outputDirectory = join(sourceDirectory, 'bin')
const frameworkDirectory = join(process.env.WINDIR ?? 'C:/Windows', 'Microsoft.NET/Framework64/v4.0.30319')
const compiler = join(frameworkDirectory, 'csc.exe')
const references = [
  'mscorlib.dll',
  'System.dll',
  'System.Core.dll',
  'System.Runtime.Serialization.dll',
  'System.Web.Extensions.dll',
  'System.Xaml.dll',
  'WindowsBase.dll',
  'PresentationCore.dll',
  'PresentationFramework.dll',
]
const gacDirectory = join(process.env.WINDIR ?? 'C:/Windows', 'Microsoft.Net/assembly')
const wpfReferences = {
  'WindowsBase.dll': join(gacDirectory, 'GAC_MSIL/WindowsBase/v4.0_4.0.0.0__31bf3856ad364e35/WindowsBase.dll'),
  'PresentationCore.dll': join(gacDirectory, 'GAC_64/PresentationCore/v4.0_4.0.0.0__31bf3856ad364e35/PresentationCore.dll'),
  'PresentationFramework.dll': join(gacDirectory, 'GAC_MSIL/PresentationFramework/v4.0_4.0.0.0__31bf3856ad364e35/PresentationFramework.dll'),
}
const sources = readdirSync(sourceDirectory)
  .filter(file => file.endsWith('.cs'))
  .map(file => join(sourceDirectory, file))

mkdirSync(outputDirectory, { recursive: true })
const result = spawnSync(compiler, [
  '/nologo',
  '/target:winexe',
  '/platform:x64',
  `/win32icon:${join(root, 'build/icon.ico')}`,
  `/win32manifest:${join(sourceDirectory, 'app.manifest')}`,
  `/out:${join(outputDirectory, 'LightTodo.Widget.exe')}`,
  ...references.map(reference => `/reference:${wpfReferences[reference] ?? join(frameworkDirectory, reference)}`),
  ...sources,
], { stdio: 'inherit' })

if (result.error) throw result.error
process.exit(result.status ?? 1)
