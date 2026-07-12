import { createMockGenerator } from '@gentorial/ai'
import { createGentorialRuntime } from '@gentorial/runtime-vue'
import { createGentorialTheme } from '@gentorial/theme-default'
import '@gentorial/theme-default/style.css'
import course from '../../../course.config.js'

const generator = createMockGenerator()
const runtime = createGentorialRuntime({
  learnerProfile: {
    detail: 'balanced',
    tone: 'conversational',
    narrative: 'timeline'
  },
  generate(request, context) {
    return generator.generate(
      {
        course,
        generate: request.generate,
        concepts: request.concepts,
        ...(request.learner ? { learner: request.learner } : {}),
        ...(request.conversation ? { conversation: request.conversation } : {})
      },
      { signal: context.signal }
    )
  }
})

export default createGentorialTheme({
  enhanceApp({ app }) {
    app.use(runtime)
  }
})
