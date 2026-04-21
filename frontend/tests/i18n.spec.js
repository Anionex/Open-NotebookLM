import { test, expect } from '@playwright/test';

test.use({ launchOptions: { executablePath: '/usr/bin/google-chrome' } });

test('language switcher translates and persists', async ({ page }) => {
  await page.addInitScript(() => {
    if (!window.sessionStorage.getItem('i18n-test-seeded')) {
      window.localStorage.setItem('thinkflow_locale', 'zh');
      window.localStorage.setItem('locale', 'zh');
      window.sessionStorage.setItem('i18n-test-seeded', '1');
    }
  });

  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  await page.goto('http://127.0.0.1:3001/', { waitUntil: 'domcontentloaded' });
  const switcher = page.locator('.thinkflow-language-switcher').first();
  await expect(switcher).toBeVisible();
  await expect(switcher).toContainText('EN');
  await expect(page.locator('body')).toContainText(/知识工作台|开启你的知识之旅/);

  await page.evaluate(() => document.querySelector('.thinkflow-language-switcher')?.click());
  await page.waitForTimeout(600);

  const englishButton = await switcher.innerText();
  const englishLang = await page.locator('html').getAttribute('lang');

  await expect(page.locator('body')).toContainText(/Knowledge Workspace|Start your knowledge journey/);
  expect(englishButton).toMatch(/中文/);
  expect(englishLang).toBe('en');

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);

  const reloadedLang = await page.locator('html').getAttribute('lang');

  await expect(page.locator('body')).toContainText(/Knowledge Workspace|Start your knowledge journey/);
  expect(reloadedLang).toBe('en');

  const blockingErrors = errors.filter((item) => !item.includes('Failed to load resource'));
  expect(blockingErrors).toEqual([]);
});

test('workspace visible chrome is mostly English after guest navigation', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('thinkflow_locale', 'en');
    window.localStorage.setItem('locale', 'en');
  });

  await page.goto('http://127.0.0.1:3001/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);

  const guest = page.getByText('Continue as guest');
  if (await guest.count()) {
    await guest.first().click();
    await page.waitForTimeout(1800);
  }

  await page.getByText('Open notebook').first().click();
  await page.waitForTimeout(3000);

  await expect(page.locator('.thinkflow-language-switcher')).toHaveCount(0);
  await expect(page.locator('body')).toContainText('Current sources');
  await expect(page.locator('body')).toContainText('Document panel guide');
  await expect(page.locator('body')).toContainText('Ask questions around the selected sources');

  const visibleChinese = await page.locator('body').evaluate((body) => {
    const text = body.textContent || '';
    const allowed = ['中文', '测试笔记本', 'ThinkFlow UI 测试'];
    let normalized = text;
    for (const item of allowed) {
      normalized = normalized.split(item).join('');
    }
    return normalized.match(/\p{Script=Han}/gu) || [];
  });

  expect(visibleChinese.length).toBeLessThanOrEqual(2);
});

test('direct non-PPT output uses sources without auto document', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('thinkflow_locale', 'zh');
    window.localStorage.setItem('locale', 'zh');
  });

  const notebookId = 'nb-source-first-output';
  const sourcePath = '/tmp/source-first.md';
  let outlinePayload = null;
  let chatCalls = 0;

  await page.route('**/api/v1/auth/config', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        supabaseConfigured: false,
        authMode: 'disabled',
      }),
    });
  });

  await page.route('**/api/v1/kb/notebooks**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        notebooks: [{ id: notebookId, name: 'Source First Notebook' }],
      }),
    });
  });

  await page.route('**/api/v1/kb/files**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        files: [
          {
            id: 'file-source-first',
            name: 'source-first.md',
            file_path: sourcePath,
            static_url: sourcePath,
            vector_ready: true,
            vector_status: 'embedded',
            created_at: '2026-04-21T08:00:00Z',
          },
        ],
      }),
    });
  });

  await page.route('**/api/v1/kb/documents**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ documents: [] }),
    });
  });

  await page.route('**/api/v1/kb/workspace-items**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [] }),
    });
  });

  await page.route('**/api/v1/kb/outputs/outline', async (route) => {
    outlinePayload = JSON.parse(route.request().postData() || '{}');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        output: {
          id: 'out-source-first-report',
          document_id: '',
          title: 'source-first.md · 报告',
          target_type: 'report',
          status: 'outlined',
          updated_at: '2026-04-21T08:00:00Z',
          created_at: '2026-04-21T08:00:00Z',
          source_names: ['source-first.md'],
          source_paths: [sourcePath],
          bound_document_ids: [],
          bound_document_titles: [],
          guidance_item_ids: [],
          outline: [
            {
              id: 'outline_1',
              title: '核心信息',
              summary: '直接基于来源生成',
              bullets: ['来源是主输入'],
            },
          ],
          result: {},
        },
      }),
    });
  });

  await page.route('**/api/v1/kb/outputs/out-source-first-report/generate', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        output: {
          id: 'out-source-first-report',
          document_id: '',
          title: 'source-first.md · 报告',
          target_type: 'report',
          status: 'generated',
          updated_at: '2026-04-21T08:00:00Z',
          created_at: '2026-04-21T08:00:00Z',
          source_names: ['source-first.md'],
          source_paths: [sourcePath],
          bound_document_ids: [],
          bound_document_titles: [],
          guidance_item_ids: [],
          outline: [],
          result: { preview_markdown: '# Report\n\nSource first.' },
        },
      }),
    });
  });

  await page.route('**/api/v1/kb/outputs**', async (route) => {
    const url = route.request().url();
    if (url.includes('/api/v1/kb/outputs?')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ outputs: [] }),
      });
      return;
    }
    await route.fallback();
  });

  await page.route('**/api/v1/kb/chat**', async (route) => {
    chatCalls += 1;
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ detail: 'chat should not be called for source-derived document creation' }),
    });
  });

  await page.goto('http://127.0.0.1:3001/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);

  await page.getByRole('button', { name: /打开笔记本|Open notebook/i }).first().click();
  await page.waitForTimeout(2200);

  await page.locator('button.thinkflow-output-toolbar-btn').filter({ hasText: /报告|Report/ }).click();
  await expect(page.getByText(/确认本次报告来源|Confirm/i)).toBeVisible();
  const modal = page.locator('.thinkflow-output-lock-modal');
  await expect(modal.locator('.thinkflow-output-lock-item', { hasText: 'source-first.md' }).first()).toBeVisible();
  await expect(modal.getByText(/直接基于来源|based on sources/i)).toBeVisible();
  await page.getByRole('button', { name: /确认并开始生成|Confirm/i }).click();
  await page.waitForTimeout(1000);

  expect(outlinePayload).not.toBeNull();
  expect(outlinePayload.document_id).toBe('');
  expect(outlinePayload.source_paths).toEqual([sourcePath]);
  expect(outlinePayload.source_names).toEqual(['source-first.md']);
  expect(chatCalls).toBe(0);
});

test('output workspace header collapses on body scroll and expands at top', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('thinkflow_locale', 'en');
    window.localStorage.setItem('locale', 'en');
  });

  const notebookId = 'nb-output-header';
  const outputId = 'out-ppt-1';
  const documentId = 'doc-output-header';
  const outline = Array.from({ length: 12 }, (_, index) => ({
    index,
    title: `Slide ${index + 1}`,
    prompt: `Focus area ${index + 1}`,
    content: `This is slide content ${index + 1}`.repeat(8),
    speaker_notes: `Notes ${index + 1}`.repeat(4),
    confirmed: index < 4,
    versions: [
      {
        id: `version-${index + 1}`,
        image_url: '',
        markdown: `# Slide ${index + 1}\n\n${'Detail '.repeat(30)}`,
        selected: true,
      },
    ],
  }));

  await page.route('**/api/v1/auth/config', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        supabaseConfigured: false,
        authMode: 'disabled',
      }),
    });
  });

  await page.route('**/api/v1/kb/notebooks**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        notebooks: [{ id: notebookId, name: 'ThinkFlow UI Test' }],
      }),
    });
  });

  await page.route('**/api/v1/kb/files**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        files: [
          {
            id: 'file-1',
            name: 'Expert_attention.pdf',
            file_path: '/tmp/Expert_attention.pdf',
            vector_ready: true,
            vector_status: 'embedded',
            created_at: '2026-04-21T08:00:00Z',
          },
        ],
      }),
    });
  });

  await page.route('**/api/v1/kb/workspace-items**', async (route) => {
    const url = route.request().url();
    if (/\/workspace-items\/[^/?]+/.test(url)) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          item: {
            id: 'guidance-1',
            type: 'guidance',
            title: 'Keep scientific tone',
            content: 'Keep scientific tone',
          },
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [
          {
            id: 'guidance-1',
            type: 'guidance',
            title: 'Keep scientific tone',
            content: 'Keep scientific tone',
          },
        ],
      }),
    });
  });

  await page.route('**/api/v1/kb/documents**', async (route) => {
    const url = route.request().url();
    if (/\/documents\/[^/?]+\/versions/.test(url)) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ versions: [] }),
      });
      return;
    }
    if (/\/documents\/[^/?]+\?/.test(url)) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          document: {
            id: documentId,
            title: 'Expert attention',
            content: 'Detailed source document',
            created_at: '2026-04-21T08:00:00Z',
            updated_at: '2026-04-21T08:00:00Z',
            version_count: 0,
          },
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        documents: [
          {
            id: documentId,
            title: 'Expert attention',
            content: 'Detailed source document',
            created_at: '2026-04-21T08:00:00Z',
            updated_at: '2026-04-21T08:00:00Z',
            version_count: 0,
          },
        ],
      }),
    });
  });

  await page.route('**/api/v1/kb/outputs**', async (route) => {
    const url = route.request().url();
    if (url.includes('/api/v1/kb/outputs?')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          outputs: [
            {
              id: outputId,
              notebook_id: notebookId,
              document_id: documentId,
              title: 'Expert_attention.pdf · PPT',
              target_type: 'ppt',
              updated_at: '2026-04-21T08:00:00Z',
              source_names: ['Expert_attention.pdf'],
              source_paths: ['/tmp/Expert_attention.pdf'],
              bound_document_ids: [documentId],
              bound_document_titles: ['Expert attention'],
              guidance_item_ids: ['guidance-1'],
              outline,
              generated_pages: [],
              status: 'outline_ready',
            },
          ],
        }),
      });
      return;
    }

    await route.fallback();
  });

  await page.goto('http://127.0.0.1:3001/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);

  await page.getByRole('button', { name: /Open notebook/i }).first().click();
  await page.waitForTimeout(2500);

  await page.getByRole('button', { name: /^Outputs/ }).click();
  await page.getByTestId(`output-card-${outputId}`).click();

  const header = page.getByTestId('output-workspace-header');
  const body = page.getByTestId('output-workspace-body');
  const details = page.getByTestId('output-workspace-header-details');
  const pills = header.locator('.thinkflow-output-context-pill');

  await expect(header).toHaveClass(/is-expanded/);
  await expect(details).toHaveAttribute('aria-hidden', 'false');
  await expect(pills).toHaveCount(3);

  await body.evaluate((element) => {
    element.scrollTop = 120;
    element.dispatchEvent(new Event('scroll', { bubbles: true }));
  });

  await expect(header).toHaveClass(/is-collapsed/);
  await expect(details).toHaveAttribute('aria-hidden', 'true');

  await body.evaluate((element) => {
    element.scrollTop = 0;
    element.dispatchEvent(new Event('scroll', { bubbles: true }));
  });

  await expect(header).toHaveClass(/is-expanded/);
  await expect(details).toHaveAttribute('aria-hidden', 'false');
});

test('quiz review state persists after scrolling output workspace', async ({ page }) => {
  const notebookId = 'nb-quiz-review';
  const outputId = 'out-quiz-1';
  const documentId = 'doc-quiz-review';

  await page.route('**/api/v1/auth/config', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        supabaseConfigured: false,
        authMode: 'disabled',
      }),
    });
  });

  await page.route('**/api/v1/kb/notebooks**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        notebooks: [{ id: notebookId, name: 'Quiz Review Notebook' }],
      }),
    });
  });

  await page.route('**/api/v1/kb/files**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ files: [] }),
    });
  });

  await page.route('**/api/v1/kb/workspace-items**', async (route) => {
    const url = route.request().url();
    if (/\/workspace-items\/[^/?]+/.test(url)) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          item: {
            id: 'guidance-quiz-1',
            type: 'guidance',
            title: 'Quiz guidance',
            content: 'Quiz guidance',
          },
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [
          {
            id: 'guidance-quiz-1',
            type: 'guidance',
            title: 'Quiz guidance',
            content: 'Quiz guidance',
          },
        ],
      }),
    });
  });

  await page.route('**/api/v1/kb/documents**', async (route) => {
    const url = route.request().url();
    if (/\/documents\/[^/?]+\/versions/.test(url)) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ versions: [] }),
      });
      return;
    }
    if (/\/documents\/[^/?]+\?/.test(url)) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          document: {
            id: documentId,
            title: 'Quiz document',
            content: 'Quiz content',
            created_at: '2026-04-21T08:00:00Z',
            updated_at: '2026-04-21T08:00:00Z',
            version_count: 0,
          },
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        documents: [
          {
            id: documentId,
            title: 'Quiz document',
            content: 'Quiz content',
            created_at: '2026-04-21T08:00:00Z',
            updated_at: '2026-04-21T08:00:00Z',
            version_count: 0,
          },
        ],
      }),
    });
  });

  await page.route('**/api/v1/kb/outputs**', async (route) => {
    const url = route.request().url();
    if (url.includes('/api/v1/kb/outputs?')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          outputs: [
            {
              id: outputId,
              notebook_id: notebookId,
              document_id: documentId,
              title: 'Quiz review output',
              target_type: 'quiz',
              updated_at: '2026-04-21T08:00:00Z',
              source_names: [],
              source_paths: [],
              bound_document_ids: [documentId],
              bound_document_titles: ['Quiz document'],
              guidance_item_ids: [],
              status: 'generated',
              result: {
                questions: [
                  {
                    id: 'q1',
                    question: 'Question one?',
                    options: [
                      { label: 'A', text: 'Alpha' },
                      { label: 'B', text: 'Beta' },
                    ],
                    correct_answer: 'A',
                    explanation: 'Explanation one',
                  },
                  {
                    id: 'q2',
                    question: 'Question two?',
                    options: [
                      { label: 'A', text: 'Gamma' },
                      { label: 'B', text: 'Delta' },
                    ],
                    correct_answer: 'B',
                    explanation: 'Explanation two',
                  },
                ],
              },
            },
          ],
        }),
      });
      return;
    }

    await route.fallback();
  });

  await page.goto('http://127.0.0.1:3001/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);

  await page.getByRole('button', { name: /打开笔记本|Open notebook/i }).first().click();
  await page.waitForTimeout(2200);

  await page.getByRole('button', { name: /产出|Outputs/i }).click();
  await page.getByTestId(`output-card-${outputId}`).click();

  await page.locator('button.thinkflow-quiz-option').nth(0).click();
  await expect(page.locator('button.thinkflow-quiz-option').nth(0)).toHaveClass(/is-selected/);
  await page.getByRole('button', { name: /下一题|Next/i }).click();
  await page.locator('button.thinkflow-quiz-option').nth(1).click();
  await expect(page.locator('button.thinkflow-quiz-option').nth(1)).toHaveClass(/is-selected/);
  await page.getByRole('button', { name: /完成测验|Finish/i }).click();
  await page.locator('.thinkflow-study-shell').getByRole('button', { name: /查看逐题复盘|Review/i }).click();

  await expect(page.getByText(/检查你的答案与每题解析|Check your answers/i)).toBeVisible();

  const body = page.getByTestId('output-workspace-body');
  await body.evaluate((element) => {
    element.scrollTop = 120;
    element.dispatchEvent(new Event('scroll', { bubbles: true }));
  });

  await expect(page.getByText(/检查你的答案与每题解析|Check your answers/i)).toBeVisible();
});
