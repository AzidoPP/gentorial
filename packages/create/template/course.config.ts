import { defineCourse } from '@gentorial/core'

export default defineCourse({
  schemaVersion: '1',
  id: '__PROJECT_NAME__',
  title: '__COURSE_TITLE__',
  lang: '__COURSE_LANG__',
  contentDir: 'content',
  generation: {
    mode: 'hybrid',
    defaultLocale: '__COURSE_LANG__'
  },
  rendering: {
    allowUnsafeHtml: __ALLOW_UNSAFE_HTML__
  },
  accuracy: {
    policies: ['概念锚点的结论不可被反转']
  }
})
