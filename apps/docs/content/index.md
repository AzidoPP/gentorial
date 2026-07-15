---
title: Gentorial 技术文档
description: 从作者定义的 Markdown 到带服务端缓存的个性化教程。
---

# Gentorial 技术文档

Gentorial 是一个以 VitePress 为基础的生成式教程框架。作者在版本控制中保存事实、范围和准确性策略；学习者只调整讲解的详略、语气和叙事方式。

::: concept docs-source-of-truth title="原文是权威来源"
作者编写的 Markdown 始终可读，AI 生成内容只能附着在明确的生成位置，不能替代或修改作者原文。
:::

## 选择生成方式

| 方式 | 密钥位置 | 共享缓存 | 适用场景 |
| --- | --- | --- | --- |
| 统一服务端 | 服务端环境变量 | 有 | 正式课程、团队文档、公共教程 |
| 浏览器 BYOK | 学习者浏览器配置 | 无 | 个人使用、无需维护服务端的站点 |

两种方式都不会回退到 mock。没有可用的真实生成配置时，原文仍然可读，生成区域明确显示错误。

::: generate docs-path-example kind=comparison concepts=docs-source-of-truth
根据学习者的技术背景，对比统一服务端与纯前端 BYOK 的请求路径、密钥边界和缓存行为，并给出选择建议。
:::

## 从这里开始

- [快速开始](./guide/getting-started.md)：创建并运行第一个项目。
- [编写教程](./guide/authoring.md)：使用 `concept` 与 `generate`。
- [统一服务端](./guide/managed-server.md)：配置统一模型、Key 和共享缓存。
- [生产部署](./guide/deployment.md)：部署静态站点与 Node 生成服务。
- [开发与测试](./guide/development.md)：运行仓库检查、浏览器 E2E 与包检查。
