/** The left sidebar's book glyph; the sidebar owns the button shell and label. */
import type { ReactNode } from 'react'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'

/**
 * Render an open-book outline at the size the sidebar requests.
 * @param props - sidebar icon share.
 * @returns decorative book glyph.
 */
export function ReaderIcon({ size }: PropsRuntime<'sidebar.panellist'>): ReactNode {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M3.25 4.4h4.1c1.45 0 2.65 1.1 2.65 2.45V16c0-1.28-1.1-2.32-2.47-2.32H3.25V4.4Zm13.5 0h-4.1c-1.45 0-2.65 1.1-2.65 2.45V16c0-1.28 1.1-2.32 2.47-2.32h4.28V4.4Z"
        stroke="currentColor"
        strokeWidth="1.45"
        strokeLinejoin="round"
      />
    </svg>
  )
}
