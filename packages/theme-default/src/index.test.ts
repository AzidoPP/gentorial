import { describe, expect, it, vi } from 'vitest'

vi.mock('vitepress/theme', () => ({ default: {} }))

import { createGentorialTheme } from './index.js'

describe('createGentorialTheme', () => {
  it('registers the controlled Gentorial components', () => {
    const component = vi.fn()
    const theme = createGentorialTheme()

    theme.enhanceApp?.({ app: { component } } as never)

    expect(component).toHaveBeenCalledWith('GentorialConcept', expect.anything())
    expect(component).toHaveBeenCalledWith('GentorialCodeBlock', expect.anything())
    expect(component).toHaveBeenCalledWith('GentorialGenerate', expect.anything())
    expect(component).toHaveBeenCalledWith('GentorialGeneratedRegion', expect.anything())
    expect(component).toHaveBeenCalledWith('GentorialGenerateTrigger', expect.anything())
    expect(component).toHaveBeenCalledWith('GentorialPreferences', expect.anything())
    expect(component).toHaveBeenCalledWith('GentorialMermaid', expect.anything())
    expect(component).toHaveBeenCalledWith('LessonBlockRenderer', expect.anything())
  })
})
