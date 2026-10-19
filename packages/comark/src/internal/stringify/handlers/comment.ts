import type { State } from 'comark/render'
import type { ElementNode } from 'comark'

export function comment(node: ElementNode, state: State, parent?: ElementNode): string {
  if (node[0] === null) {
    // Inline comments (inside a paragraph, emphasis, …) must not end the block
    return `<!--${node[2]}-->` + (parent ? '' : state.context.blockSeparator)
  }

  return ''
}
