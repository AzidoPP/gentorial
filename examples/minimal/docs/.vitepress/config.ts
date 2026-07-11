import { defineGentorialConfig } from '@gentorial/engine-vitepress'

export default defineGentorialConfig({
  title: 'Gentorial 最小示例',
  description: '概念明文、叙事生成。',
  lang: 'zh-CN',
  srcDir: '../content',
  cleanUrls: true,
  themeConfig: {
    nav: [{ text: '首页', link: '/' }],
    outline: { level: [2, 3] }
  }
})
