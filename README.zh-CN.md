# Gentorial（衍课）

> 用教学规范生成每个人自己的教程。

简体中文 · [English](./README.md)

Gentorial 是一个面向生成式教程的开源框架。作者明确写下不能漂移的概念、边界与准确性要求，再用简短的局部提示描述希望生成的讲解、示例、比较、练习或反馈。Gentorial 负责组合上下文、调用可替换的生成器、校验结构化结果，并且只渲染已经登记的课程块。

项目正在开发 `0.1.0`。工作区内所有包目前仍为 `0.0.0`，尚未发布任何 npm 包。

## 为什么做 Gentorial？

- **概念始终明文存在。** 作者写下的概念锚点会进入静态 HTML，生成内容不能将其替换。
- **生成结果受到约束。** 模型必须返回 `GeneratedLesson` 协议；任意 HTML、脚本和 Vue 模板会被拒绝。
- **失败时仍然是一份教程。** 默认界面会让失败的结果位置保持为空，并保留作者原文；自定义集成仍可选择显示回退块。
- **提供方与页面引擎可以替换。** 课程协议不依赖模型 SDK、Vue、VitePress、Nuxt 或文件系统。
- **BYOK 默认不暴露到前端。** 作者密钥应存在于构建进程、本地中继或受控服务端，而不是浏览器产物。

## 内容写法

```md
::: concept switch-discrete title="switch 的适用边界"
`switch` 根据整数类型表达式经整数提升后的离散结果选择分支。
:::

## 连续范围

成绩区间描述的是范围，而不是一个个离散值。

::: generate switch-range kind=example concepts=switch-discrete
说明 switch 为什么不适合直接判断成绩区间等连续范围。
:::

## 相似分支

当多个分支只有数据不同，重复写法可能掩盖真正的数据结构。

::: generate switch-table kind=example concepts=switch-discrete
说明相似分支在什么情况下可以改用表驱动。
:::
```

`concept` 正文属于课程规范，也属于静态页面。`generate` 正文只表达局部教学意图；课程级策略、概念原文、学习者偏好与输出协议由框架统一补入。

### 从作者章节生成

普通章节本身也可以限定内容范围，不一定要另外声明概念锚点：

```md
## C 的历史

1. ALGOL、CPL、BCPL
2. B
3. C

::: generate c-history kind=explanation
沿这条语言演化链解释 C 的形成过程，以及各阶段留下的关键设计影响。
:::
```

编译器会把作者写下的列表作为章节范围，并在最近的标题旁挂载一个低干扰入口。其视觉规范只有纯 `✦` 图标：不显示“生成”等可见文字，没有背景和边框；鼠标悬停或键盘聚焦时只改变颜色或透明度。无障碍名称为“按需展开”。

生成结果默认在原文之后直接进入正文流，只显示已经校验的 `GeneratedLesson` 内容本身。结果中不重复显示 `✦`，也没有“个性化讲解”等标签、标记、背景、边框或可见的加载/错误状态文字；可为辅助技术保留不可见的 ARIA 状态。首次请求失败时，该位置保持为空，作者原文不变；回退块能力仍供自定义集成选择，但不属于默认无感界面。重新生成只替换主结果，而不会不断追加。学习者通过全局 `detail`、`tone` 和 `narrative` 偏好控制讲解的详略、语气与叙事方式，这些偏好不会扩大作者限定的内容范围。

### 继续追问

追问能力仍绑定在每份生成讲解上。讲解出现后，末尾常驻一个带“继续追问…” placeholder 的单行输入框和“发送”按钮，不要求学习者通过点击教程正文来发现入口。Enter 或“发送”提交，Esc 取消活动请求并清空草稿。界面不显示学习者的问题，也不显示“你”“回应”等角色标签；每个通过校验的 assistant `GeneratedLesson` 作为下一段普通结构化内容插在输入框上方。

每次追问仍在内部继承同一个 `SectionScope`、引用的概念锚点、课程策略、learner profile、当前主讲解和此前已完成轮次，并继续声明相同要求下的 `sourceIds` 与 `conceptIds`。取消、失败或被新请求替代的追问不会留下可见的残缺轮次；重新展开主讲解成功后，运行时会清空绑定在旧结果上的对话。

## 包结构

| 包 | 职责 |
| --- | --- |
| `@gentorial/core` | 课程定义、协议、受控课程块、诊断与插件契约 |
| `@gentorial/content` | 纯 Markdown 指令解析与 Node.js 课程目录编译 |
| `@gentorial/ai` | 提示编译、提供方/传输契约、结果校验与确定性 mock |
| `@gentorial/runtime-vue` | 请求生命周期与受控课程块的安全 Vue 渲染 |
| `@gentorial/engine-vitepress` | VitePress 配置和 Markdown 容器接入 |
| `@gentorial/theme-default` | 默认组件注册与无障碍基础样式 |
| `@gentorial/create` | 随包发布的项目模板与未来的 `npm create @gentorial` 入口 |

`examples/minimal` 是当前纵向贯通示例。其 VitePress 静态产物包含作者写明的 `switch` 概念锚点、以章节为范围的“C 的历史”示例、标题旁生成触发器、融入正文的确定性 mock 结果，以及结果末尾的常驻追问输入与发送按钮。

`apps/website` 是 Gentorial 的静态官网，使用 React、Tailwind CSS 与 Lucide，并采用 monochrome 视觉系统。

## 本地开发

环境要求：

- Node.js `>=20.19.0`
- pnpm `11.1.2`

```bash
pnpm install
pnpm check
pnpm dev
pnpm dev:website
```

`pnpm check` 会构建所有包、最小 VitePress 示例与静态官网，执行严格 TypeScript 检查，并运行协议与集成测试。

在仓库内试用脚手架：

```bash
pnpm build
node packages/create/dist/cli.js my-course --no-install
```

生成的项目默认不需要 AI 密钥。`0.1.0` 计划提供的公开流程是：

```bash
npm create @gentorial@latest my-course
cd my-course
npm run dev
```

## 当前状态

仓库目前已经具备各包基础实现、确定性 mock 管线、融入正文的无装饰输出、结果末尾的常驻追问输入与发送按钮、全局表达偏好、VitePress 纵向示例、测试、Changesets 配置，以及 Windows/Ubuntu CI。所有包仍为 `0.0.0`，当前讲解链路使用确定性 mock，而不是真实模型。下一阶段将完成 VitePress 构建对完整课程清单的消费、页面级静默失败与自定义回退测试、一个真实的构建时提供方适配器、可审核快照和完整脚手架流程。

架构决策、安全边界、实施阶段与 `0.1.0` 完成定义见 [PLAN.md](./PLAN.md)。

## 许可证

Gentorial 使用 [MIT License](./LICENSE)。
