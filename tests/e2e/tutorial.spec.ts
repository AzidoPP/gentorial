import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '个性化设置' }).click()
  const dialog = page.getByRole('dialog', { name: '个性化设置' })
  await dialog.getByRole('button', { name: '继续' }).click()
  await dialog.getByLabel('API key').fill('e2e-test-key')
  await dialog.getByRole('button', { name: '保存并继续' }).click()
})

test('generates a lesson and answers a constrained follow-up', async ({ page }) => {
  let requestCount = 0
  await page.route('https://api.openai.com/v1/**', async (route) => {
    requestCount += 1
    const text = requestCount === 1
      ? '测试讲解：C 的历史'
      : requestCount === 2
        ? '追问回答：它保留了当前章节的概念与范围约束。'
        : '另一条回答：从根节点重新解释。'
    await route.fulfill({
      contentType: 'text/event-stream',
      body: `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\ndata: [DONE]\n\n`
    })
  })

  await expect(page.getByRole('heading', { name: 'C 的历史' })).toBeVisible()
  await expect(page.getByText('ALGOL、CPL、BCPL')).toBeVisible()

  await page.getByRole('button', { name: '按需展开：C 的历史' }).click()

  const region = page.locator('[data-generate-id="c-history"].gentorial-generated-region')
  await expect(region).toHaveAttribute('data-status', 'success')
  await expect(region.getByText('测试讲解：C 的历史')).toBeVisible()

  await region.getByPlaceholder('继续追问…').fill('为什么仍然受章节约束？')
  await region.getByRole('button', { name: '发送' }).click()

  await expect(
    region.getByText('追问回答：它保留了当前章节的概念与范围约束。')
  ).toBeVisible()
  await expect(region).not.toContainText('为什么仍然受章节约束？')

  await region.getByRole('button', { name: '学习路径' }).click()
  const questionPoint = region.getByRole('button', { name: '为什么仍然受章节约束？' })
  await questionPoint.hover()
  await expect(region.getByRole('tooltip', { name: '为什么仍然受章节约束？' })).toBeVisible()

  await region.getByRole('button', { name: '初始内容' }).click()
  await expect(
    region.getByText('追问回答：它保留了当前章节的概念与范围约束。')
  ).toBeHidden()
  await region.getByPlaceholder('继续追问…').fill('换一条路径说明。')
  await region.getByRole('button', { name: '发送' }).click()
  await expect(region.getByText('另一条回答：从根节点重新解释。')).toBeVisible()
  await expect(region.locator('.gentorial-conversation-path__point')).toHaveCount(3)
})

test('keeps author content visible when generation fails', async ({ page }) => {
  await page.route('https://api.openai.com/v1/**', async (route) => {
    await route.fulfill({ status: 503, body: 'E2E deliberate generation failure' })
  })

  const heading = page.getByRole('heading', { name: '相似分支' })
  const authorContent = page.getByText('如果多个选项只对应不同数据')

  await expect(heading).toBeVisible()
  await expect(authorContent).toBeVisible()
  await page.getByRole('button', { name: '按需展开：相似分支' }).click()

  const region = page.locator('[data-generate-id="switch-table"].gentorial-generated-region')
  await expect(region).toHaveAttribute('data-status', 'error')
  await expect(region.getByRole('alert')).toBeVisible()
  await expect(heading).toBeVisible()
  await expect(authorContent).toBeVisible()
})
