/** Stable error codes shared by the Host parser and Client messages. */
export type NovelErrorCode =
  | 'invalid-url'
  | 'blocked-host'
  | 'fetch-failed'
  | 'unsupported-page'
  | 'no-chapters'
  | 'no-content'
  | 'store-failed'

/** A fetch or parse failure with a stable code. */
export class FetchError extends Error {
  override name = 'FetchError'

  constructor(
    readonly code: NovelErrorCode,
    message: string,
    readonly url?: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
  }
}
