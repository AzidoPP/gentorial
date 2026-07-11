---
title: switch 的适用边界
---

# `switch` 的适用边界

页面先呈现作者确认的教学事实，再提供可独立请求的生成示例。即使 JavaScript 或 AI 不可用，下面的概念锚点仍然存在于静态 HTML 中。

::: concept switch-discrete title="概念锚点：离散分支"
`switch` 根据整数类型表达式经整数提升后的离散结果选择分支。
:::

## 连续范围

::: generate switch-range kind=example concepts=switch-discrete
`switch` 不适合直接判断连续范围（比如成绩区间）。
:::

## 相似分支

::: generate switch-table kind=example concepts=switch-discrete
多个选项分支基本相同，可以使用表驱动。
:::
