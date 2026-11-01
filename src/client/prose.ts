/** Join source line-wraps into paragraphs while preserving sentence breaks. */
export function proseParagraphs(content: string): string[] {
  const endsSentence = (value: string): boolean => /[。！？…!?.”’」』】）)]$/.test(value)
  const join = (left: string, right: string): string => {
    if (left === '') return right
    if (right === '') return left
    const last = left.charAt(left.length - 1)
    const first = right.charAt(0)
    return /[A-Za-z0-9]$/.test(last) && /^[A-Za-z0-9]/.test(first) ? `${left} ${right}` : left + right
  }
  const blocks = content.replace(/\r\n?/g, '\n').split(/\n{2,}/)
  const paragraphs: string[] = []
  let current = ''
  for (const block of blocks) {
    const text = block.split('\n').map(line => line.trim()).filter(Boolean).reduce(join, '')
    if (text === '') continue
    current = join(current, text)
    if (endsSentence(current)) {
      paragraphs.push(current)
      current = ''
    }
  }
  if (current !== '') paragraphs.push(current)
  return paragraphs
}

