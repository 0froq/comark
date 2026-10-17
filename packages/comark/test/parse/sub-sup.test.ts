import { describe, expect, it } from 'vitest'
import type { MarkdownItPlugin } from '../../src/types'
import markdownItSubReal from 'markdown-it-sub'
import markdownItSupReal from 'markdown-it-sup'
import { defineComarkPlugin, parseMarkdown } from '../../src/parse'

// Minimal inline rules that mirror what `markdown-it-sub` / `markdown-it-sup`
// emit: `~text~` → sub_open/text/sub_close, `^text^` → sup_open/text/sup_close.
// This lets the test pin the bug from comarkdown/comark#201 without pulling in
// the upstream packages.
function makeDelimiterRule(tag: 'sub' | 'sup', char: number) {
  return (state: any, silent: boolean) => {
    if (silent) return false
    if (state.src.charCodeAt(state.pos) !== char) return false

    const start = state.pos + 1
    const max = state.posMax
    let pos = start
    while (pos < max && state.src.charCodeAt(pos) !== char) {
      if (state.src.charCodeAt(pos) === 0x20 /* space */) return false
      pos++
    }
    if (pos === start || pos >= max) return false

    state.push(`${tag}_open`, tag, 1)
    const text = state.push('text', '', 0)
    text.content = state.src.slice(start, pos)
    state.push(`${tag}_close`, tag, -1)

    state.pos = pos + 1
    return true
  }
}

const markdownItSub: MarkdownItPlugin = (md) => {
  md.inline.ruler.after('emphasis', 'sub', makeDelimiterRule('sub', 0x7e /* ~ */))
}

const markdownItSup: MarkdownItPlugin = (md) => {
  md.inline.ruler.after('emphasis', 'sup', makeDelimiterRule('sup', 0x5e /* ^ */))
}

const subscript = defineComarkPlugin(() => ({
  name: 'subscript',
  markdownItPlugins: [markdownItSub],
}))

const superscript = defineComarkPlugin(() => ({
  name: 'superscript',
  markdownItPlugins: [markdownItSup],
}))

describe('sub/sup token mapping (regression for #201)', () => {
  it('maps sub_open tokens to a <sub> element (not <del>)', async () => {
    const tree = await parseMarkdown('H~2~O', { plugins: [subscript()] })
    expect(tree.nodes).toEqual([['p', {}, 'H', ['sub', {}, '2'], 'O']])
  })

  it('maps sup_open tokens to a <sup> element (not dropped)', async () => {
    const tree = await parseMarkdown('x^2^', { plugins: [superscript()] })
    expect(tree.nodes).toEqual([['p', {}, 'x', ['sup', {}, '2']]])
  })

  it('preserves both sub and sup in the same paragraph', async () => {
    const tree = await parseMarkdown('H~2~O and x^2^', { plugins: [subscript(), superscript()] })
    expect(tree.nodes).toEqual([['p', {}, 'H', ['sub', {}, '2'], 'O and x', ['sup', {}, '2']]])
  })
})

// Regression for comarkdown/comark#462: real markdown-it inline plugins must see
// the source untouched by auto-close (no `\~` escape inserted before `~`).
describe('real markdown-it-sub / markdown-it-sup plugins (#462)', () => {
  const realSubscript = defineComarkPlugin(() => ({
    name: 'subscript',
    markdownItPlugins: [markdownItSubReal as MarkdownItPlugin],
  }))
  const realSuperscript = defineComarkPlugin(() => ({
    name: 'superscript',
    markdownItPlugins: [markdownItSupReal as MarkdownItPlugin],
  }))

  it('parses a trailing subscript', async () => {
    const tree = await parseMarkdown('a~footnote~', { plugins: [realSubscript()] })
    expect(tree.nodes).toEqual([['p', {}, 'a', ['sub', {}, 'footnote']]])
  })

  it('parses a mid-word subscript', async () => {
    const tree = await parseMarkdown('H~2~O', { plugins: [realSubscript()] })
    expect(tree.nodes).toEqual([['p', {}, 'H', ['sub', {}, '2'], 'O']])
  })

  it('parses a non-numeric subscript followed by punctuation', async () => {
    const tree = await parseMarkdown('x~ab~.', { plugins: [realSubscript()] })
    expect(tree.nodes).toEqual([['p', {}, 'x', ['sub', {}, 'ab'], '.']])
  })

  it('parses a superscript', async () => {
    const tree = await parseMarkdown('x^2^', { plugins: [realSuperscript()] })
    expect(tree.nodes).toEqual([['p', {}, 'x', ['sup', {}, '2']]])
  })
})
