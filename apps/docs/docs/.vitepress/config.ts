import { gentorialMarkdown } from '@gentorial/engine-vitepress'
import { defineConfig } from 'vitepress'
import serverConfig from '../../gentorial.server.config.js'

const docsBase = process.env.GENTORIAL_DOCS_BASE ?? '/docs/'
const websiteUrl = process.env.GENTORIAL_WEBSITE_URL
  ?? 'https://minsecrus.github.io/gentorial/'

export default defineConfig({
  base: docsBase,
  title: 'Gentorial 技术文档',
  description: 'Gentorial 的安装、教程创作、生成服务、缓存与部署文档。',
  lang: 'zh-CN',
  srcDir: '../content',
  cleanUrls: true,
  markdown: {
    math: true,
    config: gentorialMarkdown
  },
  themeConfig: {
    siteTitle: 'Gentorial Docs',
    nav: [
      { text: '指南', link: '/guide/getting-started' },
      { text: '配置参考', link: '/reference/course-config' },
      { text: '官网', link: websiteUrl }
    ],
    sidebar: [
      {
        text: '开始使用',
        items: [
          { text: '文档首页', link: '/' },
          { text: '快速开始', link: '/guide/getting-started' },
          { text: '编写教程', link: '/guide/authoring' },
          { text: '开发与测试', link: '/guide/development' }
        ]
      },
      {
        text: '生成方式',
        items: [
          { text: '纯前端 BYOK', link: '/guide/browser-only' },
          { text: '统一服务端', link: '/guide/managed-server' },
          { text: '生产部署', link: '/guide/deployment' }
        ]
      },
      {
        text: '参考',
        items: [
          { text: '课程配置', link: '/reference/course-config' },
          { text: '服务端配置', link: '/reference/server-config' },
          { text: '包与职责', link: '/reference/packages' }
        ]
      }
    ],
    search: { provider: 'local' },
    outline: { label: '本页目录', level: [2, 3] },
    docFooter: { prev: '上一页', next: '下一页' },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/Minsecrus/gentorial' }
    ],
    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2026 Minsecrus'
    }
  },
  vite: {
    server: {
      proxy: {
        '/api/gentorial': `http://127.0.0.1:${serverConfig.port}`
      }
    }
  }
})
