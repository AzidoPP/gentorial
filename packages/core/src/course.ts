import { courseDefinitionSchema } from './schemas.js'
import type { CourseDefinition } from './types.js'

export function defineCourse<const T extends CourseDefinition>(definition: T): T {
  return courseDefinitionSchema.parse(definition) as T
}
