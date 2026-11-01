import { describe, expect, it } from 'vitest'
import { proseParagraphs } from '../src/client/prose.ts'

describe('proseParagraphs', () => {
  it('joins hard-wrapped source lines until a sentence ends', () => {
    const paragraphs = proseParagraphs(
      '尤其是有那么两三个，更是给许青一种仿佛遇到五六座天宫\n\n金丹之感，看的他眼睛一缩。\n\n天地色变。',
    )

    expect(paragraphs).toEqual([
      '尤其是有那么两三个，更是给许青一种仿佛遇到五六座天宫金丹之感，看的他眼睛一缩。',
      '天地色变。',
    ])
  })

  it('keeps normal paragraphs split and joins wrapped Latin words with a space', () => {
    expect(proseParagraphs('First line\nwrapped here.\n\nSecond paragraph.')).toEqual([
      'First line wrapped here.',
      'Second paragraph.',
    ])
  })
})
