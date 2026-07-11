import { createMockGenerator, type LearnerPreferences } from '@gentorial/ai'
import { createGentorialRuntime } from '@gentorial/runtime-vue'
import { createGentorialTheme } from '@gentorial/theme-default'
import '@gentorial/theme-default/style.css'
import course from '../../../course.config.js'

const generator = createMockGenerator()
const runtime = createGentorialRuntime({
  generate(request, context) {
    const learner = request.learner as LearnerPreferences | undefined
    return generator.generate(
      {
        course,
        generate: request.generate,
        concepts: request.concepts,
        ...(learner ? { learner } : {})
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
