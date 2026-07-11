# Gentorial（衍课）

> 用教学规范生成每个人自己的教程。

简体中文 · [English](./README.md)

Gentorial 是一个面向生成式教程的开源框架。作者明确写下不能漂移的概念、边界与准确性要求，再用简短的局部提示描述希望生成的讲解、示例、比较、练习或反馈。Gentorial 负责组合上下文、调用可替换的生成器、校验结构化结果，并且只渲染已经登记的课程块。

项目正在开发 `0.1.0`，目前尚未发布 npm 包。

## 为什么做 Gentorial？

- **概念始终明文存在。** 作者写下的概念锚点会进入静态 HTML，生成内容不能将其替换。
- **生成结果受到约束。** 模型必须返回 `GeneratedLesson` 协议；任意 HTML、脚本和 Vue 模板会被拒绝。
- **失败时仍然可读。** AI 关闭、断网、取消或结果校验失败时，页面仍保留静态回退内容。
- **提供方与页面引擎可以替换。** 课程协议不依赖模型 SDK、Vue、VitePress、Nuxt 或文件系统。
- **BYOK 默认不暴露到前端。** 作者密钥应存在于构建进程、本地中继或受控服务端，而不是浏览器产物。

## 内容写法

```md
::: concept switch-discrete title="switch 的适用边界"
`switch` 根据整数类型表达式经整数提升后的离散结果选择分支。
:::

::: generate switch-range kind=example concepts=switch-discrete
说明 switch 为什么不适合直接判断成绩区间等连续范围。
:::

::: generate switch-table kind=example concepts=switch-discrete
说明相似分支在什么情况下可以改用表驱动。
:::
```

`concept` 正文属于课程规范，也属于静态页面。`generate` 正文只表达局部教学意图；课程级策略、概念原文、学习者偏好与输出协议由框架统一补入。

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

`examples/minimal` 是当前纵向贯通示例。其 VitePress 静态产物包含作者写明的 `switch` 概念锚点、静态回退内容，以及两个相互独立的 mock 生成区块。

## 本地开发

环境要求：

- Node.js `>=20.19.0`
- pnpm `11.1.2`

```bash
pnpm install
pnpm check
pnpm dev
```

`pnpm check` 会构建所有包与最小 VitePress 示例、执行严格 TypeScript 检查，并运行协议与集成测试。

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

仓库目前已经具备各包基础实现、确定性 mock 管线、VitePress 纵向示例、测试、Changesets 配置，以及 Windows/Ubuntu CI。下一阶段将完成 VitePress 构建对完整课程清单的消费、页面级非法结果回退测试、一个真实的构建时提供方适配器、可审核快照和完整脚手架流程。

架构决策、安全边界、实施阶段与 `0.1.0` 完成定义见 [PLAN.md](./PLAN.md)。

## 许可证

Gentorial 使用 [MIT License](./LICENSE)。
