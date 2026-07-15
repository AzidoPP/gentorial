# `@gentorial/runtime-vue`

Gentorial 的 Vue 3 运行时。它接收统一的 `generate(request)` 函数，按 `GenerateSpec.id` 管理标题触发器与输出区域共享的请求状态，并把受控课程块映射为 Vue 节点。

运行时不会导入模型提供方 SDK，也不会通过 `v-html` 渲染模型输出。

```ts
import { createGentorialRuntime } from '@gentorial/runtime-vue'

app.use(createGentorialRuntime({
  learnerProfile: {
    detail: 'balanced',
    tone: 'conversational',
    narrative: 'timeline'
  },
  generate: async (request, context) => generator.generate(request, context)
}))
```

运行时默认在发起追问前拒绝超过 20 次追问或序列化后超过 120,000 字符的当前路径，不会静默裁剪祖先上下文，也不会改变已保存的树。可通过 `contextBudget: { maxFollowUps, maxCharacters }` 调整，或用 `contextBudget: false` 关闭浏览器侧保护；托管服务端仍独立执行自己的硬限制。

新的页面集成由两个组件组成：把 `GentorialGenerateTrigger` 放在标题中，把 `GentorialGeneratedRegion` 放在作者原文之后。两者只通过稳定的生成 ID 关联；重新生成会替换旧结果，取消或过期请求不会覆盖新结果。`GentorialPreferences` 使用与门户一致的两步流程：先选择内容偏好，再选择可跳过的 BYOK；BYOK 可配置提供方、密钥、模型和 Base URL，且密钥只保存在当前页面的内存中。

默认结果区只顺序渲染当前学习路径上的 `GeneratedLesson` blocks，不显示来源标签、角色、问题或等待提示。讲解出现后，末尾常驻一个带“继续追问…” placeholder 的单行输入和“发送”按钮，不依赖点击教程正文来唤起。Enter 或按钮提交，Escape 取消活动追问并清空草稿；成功回答通过 `LessonBlockRenderer` 插入输入框上方，用户问题不进入可见结果。首次请求等待期间结果区为空；生成或追问失败时显示错误，同时保留作者原文和已有合法结果。`fallback` 与错误状态也保留在运行时，供自定义界面使用。

运行时把首轮完整 `GeneratedLesson`、已有问答和当前问题作为 `conversation` 再次交给同一个 `generate` 函数，因此后续回答仍沿用原来的 section scope、概念锚点和学习者偏好。`generate` 既可返回完整 `GeneratedLesson`，也可返回 `AsyncIterable<string>`；后者被视为标准 Markdown，在首轮和追问中增量解析，并在结束后连同原始 Markdown 固化到 lesson。运行时不判断生成内容是否正确，也不暴露校验钩子。

`GentorialMarkdownRenderer` 使用 Markdown-it 将标题、段落、强调、链接、列表、引用和代码围栏直接映射为 Vue VNode，不使用 `v-html`。在默认 VitePress 主题中，`mermaid` 围栏交给已注册的 `GentorialMermaid` 组件。AI 生成不支持教程作者自定义的 VitePress 容器；这些容器仍只属于作者源文件。

也可以用运行时 API 驱动自定义界面：

```ts
await runtime.run('c-history')
await runtime.ask('c-history', '为什么 B 语言对 C 如此重要？')

const state = runtime.getState('c-history')
state.conversation   // user / assistant turns
state.followUpStatus // 'idle' | 'loading' | 'error'

runtime.selectConversationNode('c-history', state.rootConversationNodeId!)
await runtime.ask('c-history', '换一个角度解释。') // 从根节点生成另一条路径
runtime.cancelFollowUp('c-history')
```

`state.conversationNodes` 保存完整树，`activeConversationNodeId` 指向当前节点，`state.conversation` 则只投影根节点到当前节点之间已经完成的 user/assistant 问答对。选择旧节点不会发起请求；下一次普通追问成功后会成为它的新子节点。待处理问题只存在于当次请求中，失败、取消、过期响应和已被替换的响应都不会留下孤立节点。重新生成首轮内容期间保留现有树，只有新讲解成功后才会整体替换。

`GentorialGenerate` 仍作为兼容组合组件导出。新引擎应优先使用分离的触发器和输出区域。
