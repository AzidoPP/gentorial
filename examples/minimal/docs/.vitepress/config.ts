import { defineGentorialConfig } from '@gentorial/engine-vitepress'

export default defineGentorialConfig({
  title: 'Gentorial',
  description: '概念明文、叙事生成。',
  lang: 'zh-CN',
  srcDir: '../content',
  cleanUrls: true,
  themeConfig: {
    nav: [{ text: '首页', link: '/' }],
    outline: { level: [2, 3] }
  }
})
