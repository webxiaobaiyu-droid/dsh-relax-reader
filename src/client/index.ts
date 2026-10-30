/** Browser entry: mount the Remote namespace and contribute the reading page. */
import type { Context } from '@deepseek-ai/cordis'
import type { MainPanelId } from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import type {} from 'dsh-relax-reader/remote'
import remote from 'dsh-relax-reader/remote'
import { ReaderIcon } from './ReaderIcon.tsx'
import { createReaderPage } from './ReaderPage.tsx'

/** Shared by the left-sidebar launcher and the main-column page it opens. */
export const PANEL_ID = 'dsh-relax-reader' as MainPanelId

/** Services required before the Remote contribution can mount. */
export const inject = ['remote']

/**
 * Mount the generated Remote contribution, register the reading page in the
 * central `main` slot, and put its launcher in the left sidebar.
 */
export async function apply(ctx: Context): Promise<() => Promise<void>> {
  const unmountRemote = await ctx.remote.$mount(remote)
  const ui = ctx.inject(['remote.relaxReader', 'slots'], (child) => {
    const page = createReaderPage(child)
    const disposePage = child.slots.inject('main', () => child.slots.register({
      name: 'main',
      key: PANEL_ID,
    }, page))
    const disposeLauncher = child.slots.inject('sidebar.panellist', () => child.slots.register({
      name: 'sidebar.panellist',
      id: PANEL_ID,
      order: 20,
      label: () => '阅读',
    }, ReaderIcon))
    return () => {
      disposeLauncher()
      disposePage()
    }
  })
  try {
    await ui
  } catch (error) {
    await ui.dispose()
    await unmountRemote()
    throw error
  }
  return async () => {
    await ui.dispose()
    await unmountRemote()
  }
}
