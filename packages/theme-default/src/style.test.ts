import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

describe('default trigger styles', () => {
  it('keeps the heading icon free of a border and background', async () => {
    const style = await readFile(new URL('../style.css', import.meta.url), 'utf8')
    const controlsRule = style.match(/\.gentorial-generation-controls\s*\{([^}]*)\}/)?.[1]
    const triggerRule = style.match(/\.gentorial-generate-trigger\s*\{([^}]*)\}/)?.[1]
    const toolbarRule = style.match(/\.gentorial-generation-toolbar\s*\{([^}]*)\}/)?.[1]
    const toolbarButtonRule = style.match(
      /\.gentorial-generation-toolbar__button\s*\{([^}]*)\}/
    )?.[1]

    expect(controlsRule).toMatch(/width:\s*1\.75rem;/)
    expect(controlsRule).toMatch(/height:\s*1\.75rem;/)
    expect(controlsRule).toMatch(/translate:\s*0 -0\.04em;/)
    expect(controlsRule).toMatch(/vertical-align:\s*middle;/)
    expect(triggerRule).toBeDefined()
    expect(triggerRule).toMatch(/width:\s*1\.75rem;/)
    expect(triggerRule).toMatch(/height:\s*1\.75rem;/)
    expect(triggerRule).toMatch(/border:\s*0;/)
    expect(triggerRule).toMatch(/background:\s*transparent;/)
    expect(toolbarRule).toMatch(/top:\s*0;/)
    expect(toolbarRule).toMatch(/line-height:\s*1;/)
    expect(toolbarButtonRule).toMatch(/width:\s*1\.75rem;/)
    expect(toolbarButtonRule).toMatch(/height:\s*1\.75rem;/)
    expect(style).toMatch(/\.gentorial-generate-trigger:hover,[\s\S]*?background:\s*transparent;/)
  })

  it('keeps author concepts plain and marks only expanded AI results', async () => {
    const style = await readFile(new URL('../style.css', import.meta.url), 'utf8')
    const conceptRule = style.match(/\.gentorial-concept\s*\{([^}]*)\}/)?.[1]
    const regionRule = style.match(/\.gentorial-generated-region\s*\{([^}]*)\}/)?.[1]
    const expandedRule = style.match(
      /\.gentorial-generated-region\[data-expanded="true"\]\s*\{([^}]*)\}/
    )?.[1]
    const errorRule = style.match(
      /\.gentorial-generated-region--error\[data-expanded="true"\]\s*\{([^}]*)\}/
    )?.[1]
    const composerRule = style.match(
      /\.gentorial-generated-region__follow-up-composer\s*\{([^}]*)\}/
    )?.[1]
    const inputRule = style.match(
      /\.gentorial-generated-region__follow-up-input\s*\{([^}]*)\}/
    )?.[1]
    const submitRule = style.match(
      /\.gentorial-generated-region__follow-up-submit\s*\{([^}]*)\}/
    )?.[1]

    expect(conceptRule).toMatch(/margin:\s*0;/)
    expect(conceptRule).toMatch(/padding:\s*0;/)
    expect(conceptRule).toMatch(/border:\s*0;/)
    expect(conceptRule).not.toMatch(/border-inline-start/)
    expect(regionRule).toMatch(/border:\s*0;/)
    expect(regionRule).toMatch(/background:\s*transparent;/)
    expect(expandedRule).toMatch(/margin:\s*1rem 0 1\.25rem;/)
    expect(expandedRule).toMatch(/padding:\s*0\.125rem 0 0\.125rem 1rem;/)
    expect(expandedRule).toMatch(
      /border-inline-start:\s*0\.125rem solid var\(--gentorial-accent\);/
    )
    expect(errorRule).toMatch(
      /border-inline-start-color:\s*var\(--vp-c-danger-1, #b42318\);/
    )
    expect(composerRule).toMatch(/display:\s*flex;/)
    expect(composerRule).toMatch(/border:\s*1px solid var\(--gentorial-border\);/)
    expect(inputRule).toMatch(/border:\s*0;/)
    expect(inputRule).toMatch(/background:\s*transparent;/)
    expect(submitRule).toMatch(/border:\s*0;/)
    expect(submitRule).toMatch(/background:\s*transparent;/)
    expect(style).not.toContain('.gentorial-generated-region__label')
  })

  it('renders the learning path as accessible points instead of cards', async () => {
    const style = await readFile(new URL('../style.css', import.meta.url), 'utf8')
    const pointRule = style.match(
      /\.gentorial-conversation-path__point\s*\{([^}]*)\}/
    )?.[1]
    const dotRule = style.match(
      /\.gentorial-conversation-path__point > span\s*\{([^}]*)\}/
    )?.[1]
    const tooltipRule = style.match(
      /\.gentorial-conversation-path__tooltip\s*\{([^}]*)\}/
    )?.[1]

    expect(pointRule).toMatch(/width:\s*1\.75rem;/)
    expect(pointRule).toMatch(/height:\s*1\.75rem;/)
    expect(pointRule).toMatch(/background:\s*transparent;/)
    expect(dotRule).toMatch(/width:\s*0\.5rem;/)
    expect(dotRule).toMatch(/border-radius:\s*50%;/)
    expect(tooltipRule).toMatch(/opacity:\s*0;/)
    expect(style).toMatch(
      /\.gentorial-conversation-path__point:hover \+ \.gentorial-conversation-path__tooltip/
    )
  })

  it('matches the website preference card geometry and controls', async () => {
    const style = await readFile(new URL('../style.css', import.meta.url), 'utf8')

    expect(style).toContain('@import "@fontsource-variable/geist/index.css";')
    expect(style).toMatch(/\.gentorial-preferences\s*\{[\s\S]*?max-width:\s*56rem;/)
    expect(style).toMatch(/\.gentorial-preferences\s*\{[\s\S]*?padding:\s*1\.5rem;/)
    expect(style).toMatch(/\.gentorial-preferences__fields\s*\{[\s\S]*?gap:\s*1\.25rem;/)
    expect(style).toMatch(/\.gentorial-preferences__option\s*\{[\s\S]*?height:\s*2\.75rem;/)
    expect(style).toMatch(/\.gentorial-preferences__primary\s*\{[\s\S]*?min-width:\s*10rem;/)
    expect(style).toMatch(
      /\.gentorial-preferences__overlay\s*\{[\s\S]*?background:\s*rgb\(255 255 255 \/ 0\.76\);/
    )
  })
})
