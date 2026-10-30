/**
 * Standalone build for both halves of the DSH plugin.
 *
 * The Host half is a normal ESM module loaded by the Cordis loader. The browser
 * half must be wrapped as a self-registering module-table factory, because DSH
 * serves external plugin UI directly rather than through its application bundle.
 */
import { defineConfig } from 'tsdown'

const ID = 'dsh-relax-reader'

/** Modules DSH's browser module table already owns. */
const LOADER_MODULES = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-api-remotes',
  '@deepseek-ai/dsh-api-remotes/client',
  '@deepseek-ai/dsh-client-locale',
  '@deepseek-ai/dsh-client-locale/client',
  '@deepseek-ai/dsh-client-ui-layout',
  '@deepseek-ai/dsh-client-ui-layout/client',
  '@deepseek-ai/dsh-client-ui-renderer',
  '@deepseek-ai/dsh-client-ui-renderer/client',
  '@deepseek-ai/dsh-client-ui-sidebar',
  '@deepseek-ai/dsh-client-ui-sidebar/client',
  '@deepseek-ai/dsh-client-ui-slots',
  'zod',
]

export default defineConfig([
  {
    name: ID,
    entry: { index: 'lib/types/index.js' },
    outDir: 'lib',
    format: ['esm'],
    platform: 'node',
    target: 'es2024',
    fixedExtension: false,
    dts: false,
    clean: false,
    sourcemap: true,
    deps: { neverBundle: [/^@deepseek-ai\//, /^node:/, /^jsdom$/] },
  },
  {
    name: `${ID}/client`,
    entry: { client: 'src/client/index.ts' },
    outDir: 'lib',
    format: 'cjs',
    platform: 'browser',
    target: 'es2024',
    fixedExtension: false,
    dts: false,
    clean: false,
    sourcemap: true,
    deps: {
      neverBundle: LOADER_MODULES,
      alwaysBundle: [/^@deepseek-ai\/dsh-typert-protocol\/remote-info$/],
    },
    define: {
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
    },
    outputOptions: {
      entryFileNames: 'client.js',
      banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(ID)}, factory: (require) => {`,
      intro: 'var module = { exports: {} }; var exports = module.exports;',
      footer: 'return module.exports; } });',
    },
  },
])
