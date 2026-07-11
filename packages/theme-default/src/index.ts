import {
  GentorialConcept,
  GentorialGenerate,
  LessonBlockRenderer
} from '@gentorial/runtime-vue'
import type { Theme } from 'vitepress'
import DefaultTheme from 'vitepress/theme'

export type GentorialThemeOptions = {
  extends?: Theme
  enhanceApp?: NonNullable<Theme['enhanceApp']>
}

export function createGentorialTheme(options: GentorialThemeOptions = {}): Theme {
  return {
    extends: options.extends ?? DefaultTheme,
    enhanceApp(context) {
      context.app.component('GentorialConcept', GentorialConcept)
      context.app.component('GentorialGenerate', GentorialGenerate)
      context.app.component('LessonBlockRenderer', LessonBlockRenderer)
      return options.enhanceApp?.(context)
    }
  }
}
