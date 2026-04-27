import { test, expect } from '@playwright/test';

const BASE_URL = process.env.TEST_BASE_URL || 'http://127.0.0.1:3001';
const TEST_EMAIL = process.env.TEST_EMAIL || '';
const TEST_PASSWORD = process.env.TEST_PASSWORD || '';
const NOTEBOOK_NAME = process.env.TEST_NOTEBOOK_NAME || 'test-2';
const TEST_TIMEOUT = Number(process.env.TEST_TIMEOUT_MS || 240000);
const OUTPUTS_TAB_RE = /^产出$|^outputs$/i;
const CHAT_RE = /对话|chat/i;
const SIGN_IN_RE = /^登录$|^sign in$/i;
const PUSH_CHANGES_RE = /推送改动|push changes|apply changes/i;
const CONFIRM_OUTLINE_RE = /确认大纲.*逐页生成|confirm outline.*(page|pages)/i;
const OUTLINE_SUMMARY_RE = /我先总结一下当前大纲思路|let me first summarize the current outline/i;
const NO_STRUCTURAL_CHANGE_RE = /没有检测到明显结构变化|no (visible|obvious) structural change/i;

async function isVisible(locator) {
  try {
    return await locator.isVisible();
  } catch {
    return false;
  }
}

async function submitOutlineChange(page, requestText, timeoutMs) {
  const discussionInput = page.locator('textarea.thinkflow-chat-input');
  await discussionInput.fill(requestText);

  const outlineResponsePromise = page.waitForResponse((response) => {
    const url = response.url();
    return response.request().method() === 'POST'
      && url.includes('/outline-chat')
      && !url.includes('/outline-chat/apply');
  }, { timeout: timeoutMs });

  await page.locator('button.thinkflow-send-btn').click();
  return outlineResponsePromise;
}

test.describe('live ppt outline flow', () => {
  test.skip(!TEST_EMAIL || !TEST_PASSWORD, 'TEST_EMAIL / TEST_PASSWORD are required');
  test.setTimeout(TEST_TIMEOUT);

  test('logs in and verifies ppt outline discussion/apply flow', async ({ page }, testInfo) => {
    const outlineResponses = [];
    const applyResponses = [];
    const consoleErrors = [];

    page.on('console', (message) => {
      if (message.type() === 'error') {
        consoleErrors.push(message.text());
      }
    });

    page.on('response', async (response) => {
      const url = response.url();
      if (!url.includes('/api/v1/kb/outputs/')) return;
      if (url.includes('/outline-chat/apply')) {
        let body = '';
        try {
          body = await response.text();
        } catch {}
        applyResponses.push({ url, status: response.status(), body: body.slice(0, 1500) });
        return;
      }
      if (url.includes('/outline-chat')) {
        let body = '';
        try {
          body = await response.text();
        } catch {}
        outlineResponses.push({ url, status: response.status(), body: body.slice(0, 1500) });
      }
    });

    await page.goto(BASE_URL, { waitUntil: 'networkidle' });

    const loginEmailInput = page.getByRole('textbox', { name: /邮箱|email/i }).first();
    if (await loginEmailInput.isVisible().catch(() => false)) {
      await loginEmailInput.fill(TEST_EMAIL);
      await page.locator('input[type="password"]').first().fill(TEST_PASSWORD);
      await page.locator('form').getByRole('button', { name: SIGN_IN_RE }).click();
    }

    await expect(page.getByRole('button', { name: new RegExp(NOTEBOOK_NAME, 'i') }).first()).toBeVisible({ timeout: 60000 });

    const notebookCard = page.getByRole('button', { name: new RegExp(NOTEBOOK_NAME, 'i') }).first();
    await expect(notebookCard).toBeVisible({ timeout: 30000 });
    await notebookCard.click();

    await expect(page.getByText(CHAT_RE).first()).toBeVisible({ timeout: 60000 });

    await page.locator('.thinkflow-left-tabs').getByRole('button', { name: OUTPUTS_TAB_RE }).click();
    const pptOutputCard = page.locator('[data-testid^="output-card-"]').filter({ hasText: /PPT|ppt/ }).first();
    await expect(pptOutputCard).toBeVisible({ timeout: 30000 });
    await pptOutputCard.click();

    await expect(page.getByText(/大纲确认|outline/i).first()).toBeVisible({ timeout: 60000 });
    await expect(page.getByText(OUTLINE_SUMMARY_RE).first()).toBeVisible({ timeout: 120000 });

    const confirmButton = page.getByRole('button', { name: CONFIRM_OUTLINE_RE }).first();
    const initialConfirmDisabled = await confirmButton.isDisabled();

    const pushChangesButton = page.getByRole('button', { name: PUSH_CHANGES_RE }).first();
    if (await isVisible(pushChangesButton)) {
      const existingApplyResponsePromise = page.waitForResponse((response) => {
        return response.request().method() === 'POST'
          && response.url().includes('/outline-chat/apply');
      }, { timeout: TEST_TIMEOUT });
      await pushChangesButton.click();
      const existingApplyResponse = await existingApplyResponsePromise;
      expect(existingApplyResponse.status(), `outline-chat apply failed: ${applyResponses.at(-1)?.body || ''}`).toBe(200);
      await expect(page.getByRole('button', { name: PUSH_CHANGES_RE })).toHaveCount(0, { timeout: 120000 });
    }

    const slideCards = page.locator('.thinkflow-ppt-outline-card');
    const slideTitleCards = page.locator('.thinkflow-ppt-outline-card h4');
    const confirmedSlidesBefore = (await slideCards.allInnerTexts()).map((text) => text.trim()).filter(Boolean);
    const confirmedTitlesBefore = (await slideTitleCards.allInnerTexts()).map((title) => title.trim()).filter(Boolean);
    expect(confirmedTitlesBefore.length).toBeGreaterThan(0);

    const lastPageIndex = confirmedTitlesBefore.length;
    const previousLastTitle = confirmedTitlesBefore.at(-1) || `第${lastPageIndex}页`;
    const uniqueTitle = `自动化验收页 ${Date.now()}`;
    const changeRequests = [
      `只做一个确定修改：把第${lastPageIndex}页标题改成“${uniqueTitle}”。不要新增或删除页面，也不要调整其他页面。`,
      `只保留一个改动：把当前第${lastPageIndex}页标题从“${previousLastTitle}”改成“${uniqueTitle}”。除了这一页标题，不要改任何其他页面内容。`,
    ];

    let appliedRequest = '';
    for (const changeRequest of changeRequests) {
      const outlineResponse = await submitOutlineChange(page, changeRequest, TEST_TIMEOUT);
      expect(outlineResponse.status(), `outline-chat failed: ${outlineResponses.at(-1)?.body || ''}`).toBe(200);
      await expect(page.getByText('请求失败').first()).toHaveCount(0);

      try {
        await expect(page.getByTestId('ppt-outline-inline-card')).toBeVisible({ timeout: 15000 });
        appliedRequest = changeRequest;
        break;
      } catch {
        const noChangeMessageVisible = await isVisible(page.getByText(NO_STRUCTURAL_CHANGE_RE).last());
        if (!noChangeMessageVisible) {
          await page.waitForTimeout(2000);
        }
      }
    }

    expect(appliedRequest, `outline chat did not produce a pending diff.\nResponses: ${JSON.stringify(outlineResponses, null, 2)}`).not.toBe('');

    await expect(page.getByTestId('ppt-outline-inline-card')).toBeVisible({ timeout: 120000 });
    await expect(page.getByRole('button', { name: /推送这版|推送改动|push changes|apply changes/i }).first()).toBeVisible({ timeout: 120000 });
    await expect(page.getByTestId('ppt-outline-inline-card')).toContainText(/新增|删除|修改|Add|Delete|Modify/i);
    expect(await page.locator('.thinkflow-inline-outline-diff-item').count()).toBeGreaterThan(0);
    await expect(confirmButton).toBeDisabled();

    const applyResponsePromise = page.waitForResponse((response) => {
      return response.request().method() === 'POST'
        && response.url().includes('/outline-chat/apply');
    }, { timeout: TEST_TIMEOUT });

    await page.getByRole('button', { name: /推送这版|推送改动|push changes|apply changes/i }).first().click();
    const applyResponse = await applyResponsePromise;

    expect(applyResponse.status(), `outline-chat apply failed: ${applyResponses.at(-1)?.body || ''}`).toBe(200);
    await expect(page.getByTestId('ppt-outline-inline-card')).toHaveCount(0, { timeout: 120000 });
    await expect(page.getByRole('button', { name: /推送这版|推送改动|push changes|apply changes/i })).toHaveCount(0, { timeout: 120000 });
    await expect(confirmButton).toBeEnabled({ timeout: 120000 });
    await expect(page.getByText(OUTLINE_SUMMARY_RE).first()).toBeVisible({ timeout: 120000 });
    const confirmedSlidesAfter = (await slideCards.allInnerTexts()).map((text) => text.trim()).filter(Boolean);
    expect(confirmedSlidesAfter).not.toEqual(confirmedSlidesBefore);

    const visibleMessageRows = page.locator('.thinkflow-message-row');
    await expect(visibleMessageRows).toHaveCount(1, { timeout: 120000 });

    await testInfo.attach('outline-responses.json', {
      body: JSON.stringify(outlineResponses, null, 2),
      contentType: 'application/json',
    });
    await testInfo.attach('apply-responses.json', {
      body: JSON.stringify(applyResponses, null, 2),
      contentType: 'application/json',
    });
    await testInfo.attach('console-errors.json', {
      body: JSON.stringify(consoleErrors, null, 2),
      contentType: 'application/json',
    });

    await page.screenshot({
      path: testInfo.outputPath('live-ppt-outline-final.png'),
      fullPage: true,
    });

    testInfo.annotations.push({
      type: 'verification',
      description: JSON.stringify({
        notebook: NOTEBOOK_NAME,
        initialConfirmDisabled,
        outlineResponseCount: outlineResponses.length,
        applyResponseCount: applyResponses.length,
        consoleErrorCount: consoleErrors.length,
      }),
    });
  });
});
