# Gentorial

> 作者定义知识，学习者塑造教程。

[![CI](https://github.com/Minsecrus/gentorial/actions/workflows/ci.yml/badge.svg)](https://github.com/Minsecrus/gentorial/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@gentorial/create?label=%40gentorial%2Fcreate)](https://www.npmjs.com/package/@gentorial/create)
[![Node.js](https://img.shields.io/badge/Node.js-%E2%89%A522.13-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-MIT-black.svg)](./LICENSE)

[English](./README.md)

Gentorial 是一个以 VitePress 为基础的生成式教程框架。作者负责定义长期有效的事实、章节范围与准确性规则；学习者可以选择适合自己的详略程度、语气、叙事方式和示例类型。

作者原文始终可直接阅读。AI 只是挂载在文档明确位置上的可选讲解层，不会替代教程正文。

## 为什么需要 Gentorial

传统文档为所有人提供同一套解释；通用聊天虽然能调整表达，却容易脱离作者原本的教学范围和事实来源。Gentorial 将两种责任明确分开：

- **作者定义课程。** 概念锚点、正文范围、生成提示和准确性策略都保存在可版本控制的文件中。
- **学习者调整表达。** 全局偏好只改变详略、语气、叙事和示例，不反转作者写明的结论。
- **生成内容留在文档中。** 讲解出现在对应正文之后，可就地重新生成、复制、折叠和继续追问。
- **AI 始终可选。** 没有密钥时使用确定性 mock；学习者也可以主动开启受支持提供方的 BYOK。

## 核心能力

- 使用原生 VitePress 配置，不引入第二套站点配置抽象。
- 通过带稳定 ID 和章节范围的 `concept`、`generate` Markdown 容器编写教程。
- 结构化结果与流式 Markdown 都通过受控 Vue 组件渲染。
- Vue 3 运行时内置取消请求、过期响应保护、重新生成和连续追问。
- 全局学习偏好可作用于不同生成章节。
- 支持 OpenAI、Anthropic、Google 和 OpenAI-compatible 浏览器 BYOK，并可配置模型与 Base URL。
- 提供框架无关的服务端生成适配器，支持 JSON lesson、SSE Markdown、鉴权和取消传播。
- 学习者密钥默认只保存在当前页面的内存中。
- 默认启用 VitePress MathJax LaTeX 与懒加载 Mermaid。
- 交互式脚手架支持 npm、pnpm、Yarn 和 Bun。
- 默认主题不通过 `v-html` 渲染模型输出。

## 快速开始

环境要求：

- Node.js `>=22.13.0`
- npm、pnpm、Yarn 2+ 或 Bun 之一

使用你偏好的包管理器创建项目：

```bash
# npm
npm create @gentorial@latest my-course

# pnpm
pnpm create @gentorial@latest my-course

# Yarn 2+
yarn dlx -p @gentorial/create@latest create-gentorial my-course

# Bun
bunx -p @gentorial/create@latest create-gentorial my-course
```

脚手架会询问缺失的课程信息，识别当前包管理器，并让你选择是否安装依赖和初始化 Git。随后按脚手架打印的命令启动站点，例如：

```bash
cd my-course
pnpm dev
```

新项目无需 API 密钥即可打开。学习者明确配置 BYOK 之前，页面使用确定性生成器。

## 生成的项目结构

```text
my-course/
├─ content/
│  └─ index.md
├─ docs/
│  └─ .vitepress/
│     ├─ config.ts
│     └─ theme/
│        └─ index.ts
├─ course.config.ts
├─ package.json
├─ README.md
└─ tsconfig.json
```

- `content/` 保存作者编写的教程正文。
- `docs/.vitepress/config.ts` 是标准 VitePress 配置。
- `docs/.vitepress/theme/index.ts` 连接 Gentorial 运行时与生成器。
- `course.config.ts` 定义稳定的课程元数据、生成模式、语言和准确性策略。

## 编写教程

权威内容仍然使用普通 Markdown。对于生成讲解必须保留的结论，使用 `concept`；在适合个性化讲解的章节中，再添加 `generate`：

```md
## 什么时候使用 `switch`

::: concept switch-discrete title="离散分支"
`switch` 根据整数表达式的离散结果选择分支。
:::

范围判断描述的是连续区间，因此通常使用 `if` 链更清晰。

::: generate switch-range kind=example concepts=switch-discrete
解释为什么 `switch` 不适合直接处理成绩区间，再给出一个简洁替代方案。
:::
```

`generate` 会取得当前章节作为来源范围，并显式引用所需的概念锚点。生成结果插入作者正文之后，不会覆盖原文。

目前支持 `explanation`、`example`、`comparison`、`exercise` 和 `feedback` 五种生成类型。

## 接入 VitePress

Gentorial 直接使用 VitePress 原生 Markdown 钩子：

```ts
// docs/.vitepress/config.ts
import { gentorialMarkdown } from '@gentorial/engine-vitepress'
import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'My course',
  srcDir: '../content',
  markdown: {
    math: true,
    config: gentorialMarkdown
  }
})
```

默认主题负责安装 Vue 运行时，并在确定性生成器与学习者启用的 BYOK 之间进行选择：

```ts
// docs/.vitepress/theme/index.ts
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
    narrative: 'direct'
  },
  generate: (request, context) => generator.generate({
    course,
    generate: request.generate,
    concepts: request.concepts,
    ...(request.learner ? { learner: request.learner } : {}),
    ...(request.conversation ? { conversation: request.conversation } : {})
  }, { signal: context.signal })
})

export default createGentorialTheme({
  enhanceApp({ app }) {
    app.use(runtime)
  }
})
```

脚手架生成的主题文件已经包含完整 import、课程配置和 BYOK 提供方选择。上面的缩略示例只用于说明运行时边界。

## AI 与安全边界

Gentorial 将模型输出视为不可信数据：

1. 引擎汇总当前章节、概念锚点、学习者偏好和可选对话。
2. 提供方无关的生成器返回 `GeneratedLesson` 或标准 Markdown 流。
3. Vue 组件直接渲染受控 block，不把模型文本交给 `v-html`。

Gentorial 不判断生成内容是否正确，也不提供内容校验钩子。准确性策略和 grounding 是课程作者提供给模型的提示上下文，不是框架的强制检查层。

运行时 Markdown 使用与 VitePress 兼容的 CommonMark 结构，支持标题、段落、强调、链接、列表、引用、代码围栏和 `mermaid` 围栏。教程作者定义的 VitePress 自定义容器明确不属于 AI 生成契约。

BYOK 完全由学习者主动开启。默认界面输入的密钥只保存在当前页面内存中，并直接发送给所选提供方。不要把课程作者的生产密钥写入浏览器 bundle；托管凭据应放在服务端或本地中继中。

## 包结构

| 包 | 职责 |
| --- | --- |
| [`@gentorial/core`](./packages/core) | 课程 schema、稳定协议类型与校验 |
| [`@gentorial/content`](./packages/content) | Markdown 解析与课程 manifest 编译 |
| [`@gentorial/ai`](./packages/ai) | 提示编译、结构化与流式生成、mock 与 BYOK 适配器 |
| [`@gentorial/runtime-vue`](./packages/runtime-vue) | Vue 状态、生成生命周期、偏好与安全渲染 |
| [`@gentorial/engine-vitepress`](./packages/engine-vitepress) | VitePress Markdown 接入与指令转换 |
| [`@gentorial/theme-default`](./packages/theme-default) | 默认 VitePress 主题接入与样式 |
| [`@gentorial/create`](./packages/create) | 交互式脚手架与随包发布的项目模板 |

## 本地开发

Gentorial 使用 pnpm workspace：

```bash
git clone https://github.com/Minsecrus/gentorial.git
cd gentorial
pnpm install
pnpm check
```

常用命令：

```bash
pnpm dev          # 启动最小 VitePress 示例
pnpm dev:website  # 启动项目官网
pnpm build        # 构建所有包和应用
pnpm typecheck    # 检查所有 workspace 项目的类型
pnpm test         # 运行测试
```

CI 会在 Windows、Ubuntu 以及 Node.js 22.13、24 的矩阵中执行完整检查和 npm 包 dry-run。

## 项目状态

Gentorial `0.1.x` 是首个公开框架版本。作者编写、生成管线、全局偏好、BYOK、VitePress 和脚手架链路已经可用，但 `1.0` 前 API 仍可能调整。生产部署需要自行审核模型传输、隐私要求、内容策略和生成结果评估方案。

架构决策与后续计划见 [PLAN.md](./PLAN.md)。

## 参与贡献

欢迎提交 Issue 和范围明确的 Pull Request。行为变更应附带测试，并在提交前运行 `pnpm check`。

## 许可证

[MIT](./LICENSE) © 2026 Minsecrus
