import { describe, expect, it, vi } from 'vitest'
import { createGentorialRuntime } from './index.js'

describe('createGentorialRuntime', () => {
  it('keeps generation behind the injected function', async () => {
    const generate = vi.fn().mockResolvedValue({
      schemaVersion: '1',
      blocks: [{ type: 'paragraph', text: 'mock' }],
      grounding: { conceptIds: ['concept'] }
    })
    const runtime = createGentorialRuntime({ generate })
    const controller = new AbortController()

    await runtime.generate(
      {
        generate: {
          id: 'example',
          kind: 'example',
          prompt: 'prompt',
          concepts: ['concept'],
          source: { file: 'content/index.md', line: 1 }
        },
        concepts: [
          {
            id: 'concept',
            statement: 'statement',
            source: { file: 'content/index.md', line: 1 }
          }
        ]
      },
      { signal: controller.signal }
    )

    expect(generate).toHaveBeenCalledOnce()
  })
})
