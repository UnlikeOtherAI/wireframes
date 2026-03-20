import { expect, test } from '@playwright/test'

async function loginAndOpenProject(page: import('@playwright/test').Page) {
  await page.goto('/login')
  await expect(page.getByTestId('login-card')).toBeVisible()
  await page.getByRole('button', { name: 'Dev login' }).click()
  await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible()
  await page.getByRole('link', { name: 'Local Demo Project' }).click()
  await expect(page.getByRole('heading', { name: 'Project Editor' })).toBeVisible()
}

test('shows a centered login card with authenticator and dev login actions', async ({ page }) => {
  await page.goto('/login')

  const card = page.getByTestId('login-card')
  await expect(card).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Dev login' })).toBeVisible()

  const box = await card.boundingBox()
  const viewportSize = page.viewportSize()
  expect(box).not.toBeNull()
  expect(viewportSize).not.toBeNull()

  const horizontalCenter = box!.x + box!.width / 2
  const verticalCenter = box!.y + box!.height / 2

  expect(Math.abs(horizontalCenter - viewportSize!.width / 2)).toBeLessThan(80)
  expect(Math.abs(verticalCenter - viewportSize!.height / 2)).toBeLessThan(140)
})

test('consistent top bar with logo across dashboard and editor', async ({ page }) => {
  await page.goto('/login')
  await page.getByRole('button', { name: 'Dev login' }).click()
  await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible()

  // Top bar logo should be visible on dashboard
  await expect(page.getByRole('link', { name: 'W Wireframes' })).toBeVisible()

  // Navigate to editor
  await page.getByRole('link', { name: 'Local Demo Project' }).click()
  await expect(page.getByRole('heading', { name: 'Project Editor' })).toBeVisible()

  // Top bar logo should still be visible in editor
  await expect(page.getByRole('link', { name: 'W Wireframes' })).toBeVisible()

  // Back button navigates to dashboard
  await page.getByLabel('Back to dashboard').click()
  await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible()
})

test('supports creating a new page from the editor via modal dialog', async ({ page }) => {
  await loginAndOpenProject(page)

  await page.getByRole('button', { name: 'New file' }).click()
  await expect(page.getByTestId('create-file-dialog')).toBeVisible()

  const documentId = `pw_page_${test.info().parallelIndex}_${Date.now()}`
  await page.getByLabel('File id').fill(documentId)
  await page.getByRole('button', { name: 'Create file' }).click()

  await expect(page.getByTestId('create-file-dialog')).toHaveCount(0)
  await expect(page.getByRole('button', { name: `${documentId}.yaml` })).toBeVisible()
})

test('source/preview toggle switches center view', async ({ page }) => {
  await loginAndOpenProject(page)

  // Default is preview mode
  await expect(page.getByTestId('view-preview-btn')).toBeVisible()
  await expect(page.getByTestId('view-source-btn')).toBeVisible()
  await expect(page.getByTestId('preview-area')).toBeVisible()

  // Click a document to switch to source
  await page.getByRole('button', { name: 'home.yaml' }).click()
  await expect(page.getByTestId('preview-area')).toHaveCount(0)

  // Toggle back to preview
  await page.getByTestId('view-preview-btn').click()
  await expect(page.getByTestId('preview-area')).toBeVisible()

  // Toggle to source
  await page.getByTestId('view-source-btn').click()
  await expect(page.getByTestId('preview-area')).toHaveCount(0)
})

test('pins chat, persists pane preferences, and applies a dev chat change', async ({ page }) => {
  await loginAndOpenProject(page)

  await page.getByRole('button', { name: 'home.yaml' }).click()
  await expect(page.getByTestId('resize-nav-handle')).toBeVisible()

  // Drag the nav resize handle
  const navHandle = page.getByTestId('resize-nav-handle')
  const navBox = await navHandle.boundingBox()
  expect(navBox).not.toBeNull()
  await page.mouse.move(navBox!.x + navBox!.width / 2, navBox!.y + navBox!.height / 2)
  await page.mouse.down()
  await page.mouse.move(navBox!.x + 48, navBox!.y + navBox!.height / 2)
  await page.mouse.up()

  await expect.poll(async () => page.evaluate(() => document.cookie)).toContain('wf_editor_nav_split=')

  // Open and pin chat
  await page.getByRole('button', { name: 'Open chat' }).click()
  await expect(page.getByTestId('chat-popup')).toBeVisible()
  await page.getByLabel('Pin').click()
  await expect(page.getByTestId('chat-pinned-panel')).toBeVisible()

  // Drag the chat resize handle
  const chatHandle = page.getByTestId('resize-chat-handle')
  const chatBox = await chatHandle.boundingBox()
  expect(chatBox).not.toBeNull()
  await page.mouse.move(chatBox!.x + chatBox!.width / 2, chatBox!.y + chatBox!.height / 2)
  await page.mouse.down()
  await page.mouse.move(chatBox!.x - 36, chatBox!.y + chatBox!.height / 2)
  await page.mouse.up()

  await expect.poll(async () => page.evaluate(() => document.cookie)).toContain('wf_editor_chat_split=')
  await expect.poll(async () => page.evaluate(() => document.cookie)).toContain('wf_editor_chat_pinned=true')

  // Send a chat message
  await page.getByLabel('Chat message').fill('Add a visible note to this page.')
  await page.getByRole('button', { name: 'Send' }).click()

  await expect(page.getByTestId('chat-message-assistant').last()).toContainText('local development update')
  await expect(page.getByTestId('chat-diff-preview')).toBeVisible()

  // Unpin chat and verify conversation persists in popup
  await page.getByLabel('Unpin').click()
  await expect(page.getByTestId('chat-pinned-panel')).toHaveCount(0)
  await page.getByRole('button', { name: 'Open chat' }).click()
  await expect(page.getByTestId('chat-popup')).toContainText('local development update')
  await expect(page.getByTestId('chat-diff-preview')).toBeVisible()

  // Apply the proposed change
  await page.getByRole('button', { name: 'Apply' }).click()
  await expect(page.getByTestId('chat-diff-preview')).toHaveCount(0)

  // Verify the document was updated on the server
  const token = await page.evaluate(() => window.localStorage.getItem('wireframes_token'))
  const projectId = page.url().split('/projects/')[1]
  expect(token).toBeTruthy()
  expect(projectId).toBeTruthy()

  const content = await page.evaluate(async ({ authToken, currentProjectId }) => {
    const response = await fetch(`/api/projects/${currentProjectId}/documents/page/home`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    })
    const json = await response.json()
    return json.content as string
  }, { authToken: token, currentProjectId: projectId })

  expect(content).toContain('Dev chat update: Add a visible note to this page.')

  // Reload and verify cookie persistence
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Project Editor' })).toBeVisible()
  await expect.poll(async () => page.evaluate(() => document.cookie)).toContain('wf_editor_chat_pinned=false')
  await expect.poll(async () => page.evaluate(() => document.cookie)).toContain('wf_editor_nav_split=')
  await expect.poll(async () => page.evaluate(() => document.cookie)).toContain('wf_editor_chat_split=')
})
