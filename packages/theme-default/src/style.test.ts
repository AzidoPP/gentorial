import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

describe('default trigger styles', () => {
  it('keeps the heading icon free of a border and background', async () => {
    const style = await readFile(new URL('../style.css', import.meta.url), 'utf8')
    const triggerRule = style.match(/\.gentorial-generate-trigger\s*\{([^}]*)\}/)?.[1]

    expect(triggerRule).toBeDefined()
    expect(triggerRule).toMatch(/border:\s*0;/)
    expect(triggerRule).toMatch(/background:\s*transparent;/)
    expect(style).toMatch(
      /\.gentorial-generate-trigger:hover,[\s\S]*?background:\s*transparent;/
    )
  })

  it('lets generated blocks flow without result chrome', async () => {
    const style = await readFile(new URL('../style.css', import.meta.url), 'utf8')
    const regionRule = style.match(/\.gentorial-generated-region\s*\{([^}]*)\}/)?.[1]
    const composerRule = style.match(
      /\.gentorial-generated-region__follow-up-composer\s*\{([^}]*)\}/
    )?.[1]
    const inputRule = style.match(
      /\.gentorial-generated-region__follow-up-input\s*\{([^}]*)\}/
    )?.[1]
    const submitRule = style.match(
      /\.gentorial-generated-region__follow-up-submit\s*\{([^}]*)\}/
    )?.[1]

    expect(regionRule).toMatch(/margin:\s*0;/)
    expect(regionRule).toMatch(/padding:\s*0;/)
    expect(regionRule).toMatch(/border:\s*0;/)
    expect(regionRule).toMatch(/background:\s*transparent;/)
    expect(composerRule).toMatch(/display:\s*flex;/)
    expect(composerRule).toMatch(/border:\s*1px solid var\(--gentorial-border\);/)
    expect(inputRule).toMatch(/border:\s*0;/)
    expect(inputRule).toMatch(/background:\s*transparent;/)
    expect(submitRule).toMatch(/border:\s*0;/)
    expect(submitRule).toMatch(/background:\s*transparent;/)
    expect(style).not.toContain('.gentorial-generated-region__label')
  })
})
