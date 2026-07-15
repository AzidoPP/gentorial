import {
  GentorialConcept,
  GentorialGenerate,
  GentorialGeneratedRegion,
  GentorialGenerateTrigger,
  GentorialMarkdownRenderer,
  GentorialPreferences,
  LessonBlockRenderer
} from '@gentorial/runtime-vue'
import type { Theme } from 'vitepress'
import { defineComponent, h } from 'vue'
import DefaultTheme from 'vitepress/theme'
import { GentorialMermaid } from './mermaid.js'

export type GentorialThemeOptions = {
  extends?: Theme
  enhanceApp?: NonNullable<Theme['enhanceApp']>
}

export function createGentorialTheme(options: GentorialThemeOptions = {}): Theme {
  const baseTheme = options.extends ?? DefaultTheme
  const BaseLayout = baseTheme.Layout ?? DefaultTheme.Layout
  const Layout = defineComponent({
    name: 'GentorialLayout',
    setup() {
      return () => h(BaseLayout!, null, {
        'nav-bar-content-after': () => h(GentorialPreferences, { presentation: 'nav' })
      })
    }
  })

  return {
    extends: baseTheme,
    Layout,
    enhanceApp(context) {
      context.app.component('GentorialConcept', GentorialConcept)
      context.app.component('GentorialGenerate', GentorialGenerate)
      context.app.component('GentorialGeneratedRegion', GentorialGeneratedRegion)
      context.app.component('GentorialGenerateTrigger', GentorialGenerateTrigger)
      context.app.component('GentorialMarkdownRenderer', GentorialMarkdownRenderer)
      context.app.component('GentorialPreferences', GentorialPreferences)
      context.app.component('GentorialMermaid', GentorialMermaid)
      context.app.component('LessonBlockRenderer', LessonBlockRenderer)
      return options.enhanceApp?.(context)
    }
  }
}
