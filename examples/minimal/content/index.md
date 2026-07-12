---
title: 在开始编程之前
---

# 在开始编程之前

<GentorialPreferences />

## C 的历史

1. ALGOL、CPL、BCPL
2. B
3. C

::: generate c-history kind=explanation
沿这条语言演化链解释 C 的形成过程，以及各阶段留下的关键设计影响；不要扩展成无关的通用计算机史。
:::

## `switch` 的适用边界

::: concept switch-discrete
`switch` 根据整数类型表达式经整数提升后的离散结果选择分支。
:::

### 连续范围

成绩区间一类问题描述的是连续范围，而 `switch` 面向的是离散分支值。

::: generate switch-range kind=example concepts=switch-discrete
`switch` 不适合直接判断连续范围（比如成绩区间）。
:::

### 相似分支

如果多个选项只对应不同数据，而执行步骤保持相同，重复分支可能掩盖真正的数据结构。

::: generate switch-table kind=example concepts=switch-discrete
多个选项分支基本相同，可以使用表驱动。
:::
