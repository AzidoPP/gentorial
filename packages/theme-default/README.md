# `@gentorial/theme-default`

Gentorial 的默认 VitePress 主题集成。它在 VitePress 中注册运行时组件，并提供概念、标题纯图标按钮、原文后正文直出、结果内追问、学习者偏好和课程块的基础样式。

```ts
import { createGentorialTheme } from '@gentorial/theme-default'
import '@gentorial/theme-default/style.css'

export default createGentorialTheme()
```

标题图标没有背景色和边框，默认低存在感，在标题悬停或键盘聚焦时增强；触屏设备会保留可发现的点击面积。样式同时处理 `prefers-reduced-motion` 和强制高对比模式。

结果区域没有可见标签、标记、背景、边框或额外状态文案，只让 `GeneratedLesson` 的课程块接在作者原文后自然排版。讲解末尾常驻一个轻量的追问输入组合：输入框带“继续追问…” placeholder，末尾提供“发送”按钮；正文点击本身没有交互。
