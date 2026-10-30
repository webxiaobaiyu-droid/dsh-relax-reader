#!/usr/bin/env node
/**
 * Point this standalone checkout at the local DeepSeek Harness source tree.
 *
 * The Harness' internal @deepseek-ai packages are not published in the versions
 * this plugin compiles against, so a source checkout is the only source of the
 * type surfaces and runtime peers. The profile already has the Harness packages
 * at runtime; these links only make local typecheck/build resolve them.
 */
import { existsSync, lstatSync, mkdirSync, rmSync, symlinkSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const argv = process.argv.slice(2)
const at = argv.indexOf('--src')
const requested = at >= 0 ? argv[at + 1] : process.env.DSH_SRC
const candidates = [
  resolve(ROOT, '../../../openSource/deepseek-harness'),
  resolve(homedir(), 'deepseek-harness'),
]
const source = requested === undefined || requested === ''
  ? candidates.find(value => existsSync(join(value, 'package.json')))
  : resolve(requested)
if (source === undefined || !existsSync(join(source, 'package.json'))) {
  console.error('link-dsh: no DeepSeek Harness checkout found. Pass --src <path> or set DSH_SRC.')
  process.exit(1)
}

/** Package name -> directory relative to the Harness checkout. */
const PACKAGES = {
  'cordis': 'vendor/cordis',
  'dsh-typert-protocol': 'packages/typert/protocol',
  'dsh-api-remotes': 'packages/api/remotes',
  'dsh-api-gateway': 'packages/api/gateway',
  'dsh-client-locale': 'packages/client/locale',
  'dsh-client-ui-layout': 'packages/client/ui-layout',
  'dsh-client-ui-renderer': 'packages/client/ui-renderer',
  'dsh-client-ui-sidebar': 'packages/client/ui-sidebar',
  'dsh-client-ui-slots': 'packages/client/ui-slots',
  'dsh-client-connection': 'packages/client/connection',
  'dsh-scope': 'packages/core/scope',
}

if (!existsSync(join(source, 'package.json'))) {
  console.error(`link-dsh: ${source} is not a DeepSeek Harness checkout`)
  process.exit(1)
}

const scope = join(ROOT, 'node_modules', '@deepseek-ai')
mkdirSync(scope, { recursive: true })
for (const [name, relative] of Object.entries(PACKAGES)) {
  const target = join(source, relative)
  if (!existsSync(join(target, 'package.json'))) {
    console.error(`link-dsh: missing ${target}`)
    process.exit(1)
  }
  const link = join(scope, name)
  if (lstatSync(link, { throwIfNoEntry: false }) !== undefined) rmSync(link, { recursive: true, force: true })
  symlinkSync(target, link, 'dir')
  console.log(`link-dsh: @deepseek-ai/${name} -> ${target}`)
}
