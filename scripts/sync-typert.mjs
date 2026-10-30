import { copyFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const root = new URL('..', import.meta.url)
const source = new URL('../typert/', import.meta.url)
const target = new URL('../lib/', import.meta.url)
mkdirSync(target, { recursive: true })
for (const file of [
  'typert.host.js',
  'typert.host.d.ts',
  'typert.remote-client.js',
  'typert.remote-client.d.ts',
]) {
  copyFileSync(new URL(file, source), new URL(file, target))
}
console.log(`sync-typert: copied generated Remote artifacts into ${join(root.pathname, 'lib')}`)
