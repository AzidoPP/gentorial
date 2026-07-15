import {
  createBrowserByokGenerator,
  createMockGenerator,
  type BrowserByokProvider
} from '@gentorial/ai'
import { createGentorialRuntime } from '@gentorial/runtime-vue'
import { createGentorialTheme } from '@gentorial/theme-default'
import '@gentorial/theme-default/style.css'
import course from '../../../course.config.js'

const generator = createMockGenerator()
const runtime = createGentorialRuntime({
  allowUnsafeHtml: course.rendering?.allowUnsafeHtml,
  learnerProfile: {
    detail: 'balanced',
    tone: 'conversational',
    narrative: 'timeline'
  },
  generate(request, context) {
    const input = {
      course,
      generate: request.generate,
      concepts: request.concepts,
      ...(request.learner ? { learner: request.learner } : {}),
      ...(request.conversation ? { conversation: request.conversation } : {})
    }
    const activeGenerator = context.byok
      ? createBrowserByokGenerator({
          ...context.byok,
          provider: context.byok.provider as BrowserByokProvider
        })
      : generator
    return activeGenerator.stream?.(input, { signal: context.signal })
      ?? activeGenerator.generate(input, { signal: context.signal })
  }
})

export default createGentorialTheme({
  enhanceApp({ app }) {
    app.use(runtime)
  }
})
