import { describe, expect, it } from 'vitest'
import { assertPublicUrl, decodeHtml, isPrivateAddress } from '../src/fetcher.ts'

describe('assertPublicUrl', () => {
  it.each([
    'http://127.0.0.1/book',
    'http://10.2.3.4/',
    'http://172.20.1.1/',
    'http://192.168.1.2/',
    'http://169.254.169.254/latest/meta-data',
    'http://100.64.0.1/',
    'http://[::1]/',
    'http://[fc00::1]/',
  ])('rejects private address %s', async (url) => {
    await expect(assertPublicUrl(url)).rejects.toMatchObject({ code: 'blocked-host' })
  })

  it('rejects non-http schemes and credentials', async () => {
    await expect(assertPublicUrl('file:///etc/passwd')).rejects.toMatchObject({ code: 'invalid-url' })
    await expect(assertPublicUrl('https://user:pass@example.com/')).rejects.toMatchObject({ code: 'invalid-url' })
    await expect(assertPublicUrl('not a url')).rejects.toMatchObject({ code: 'invalid-url' })
  })

  it('accepts a public IP literal', async () => {
    await expect(assertPublicUrl('https://1.1.1.1/')).resolves.toBeInstanceOf(URL)
  })
})

describe('private address ranges', () => {
  it('covers IPv4-mapped loopback', () => {
    expect(isPrivateAddress('::ffff:127.0.0.1')).toBe(true)
  })

  it('does not flag a public address', () => {
    expect(isPrivateAddress('8.8.8.8')).toBe(false)
  })
})

describe('decodeHtml', () => {
  it('decodes GBK aliases through gb18030', () => {
    const bytes = Uint8Array.from([0xd6, 0xd0, 0xce, 0xc4])
    expect(decodeHtml(bytes, 'text/html; charset=gbk')).toBe('中文')
  })

  it('falls back to UTF-8 for an unknown charset', () => {
    expect(decodeHtml(new TextEncoder().encode('你好'), 'text/html; charset=made-up')).toBe('你好')
  })
})
