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

test('notebook resumes latest conversation by default', async ({ page }) => {
  const notebookId = 'nb-conv-resume';
  let createConversationCalls = 0;

  await page.route('**/api/v1/auth/config', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ supabaseConfigured: false, authMode: 'disabled' }),
    });
  });

  await page.route('**/api/v1/kb/notebooks**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ notebooks: [{ id: notebookId, name: 'Conversation Notebook' }] }),
    });
  });

  await page.route('**/api/v1/kb/files**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ files: [] }) });
  });

  await page.route('**/api/v1/kb/workspace-items**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [] }) });
  });

  await page.route('**/api/v1/kb/documents**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ documents: [] }) });
  });

  await page.route('**/api/v1/kb/outputs**', async (route) => {
    if (route.request().url().includes('/api/v1/kb/outputs?')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ outputs: [] }) });
      return;
    }
    await route.fallback();
  });

  await page.route('**/api/v1/kb/conversations?**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        conversations: [
          {
            id: 'conv-latest',
            notebook_id: notebookId,
            title: 'Latest thread',
            created_at: '2026-04-21T09:00:00Z',
            updated_at: '2026-04-21T10:00:00Z',
          },
          {
            id: 'conv-older',
            notebook_id: notebookId,
            title: 'Older thread',
            created_at: '2026-04-20T09:00:00Z',
            updated_at: '2026-04-20T10:00:00Z',
          },
        ],
      }),
    });
  });

  await page.route('**/api/v1/kb/conversations/conv-latest/messages', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        messages: [
          { id: 'm1', role: 'user', content: 'Latest question?', created_at: '2026-04-21T09:30:00Z' },
          { id: 'm2', role: 'assistant', content: 'Latest answer.', created_at: '2026-04-21T09:31:00Z' },
        ],
      }),
    });
  });

  await page.route('**/api/v1/kb/conversations', async (route) => {
    if (route.request().method() === 'POST') {
      createConversationCalls += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          conversation_id: 'conv-created',
          conversation: { id: 'conv-created', title: '新对话' },
        }),
      });
      return;
    }
    await route.fallback();
  });

  await page.goto('http://127.0.0.1:3001/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);

  await page.getByRole('button', { name: /打开笔记本|Open notebook/i }).first().click();
  await page.waitForTimeout(2500);

  await expect(page.getByText('Latest question?')).toBeVisible();
  await expect(page.getByText('Latest answer.')).toBeVisible();
  expect(createConversationCalls).toBe(0);
});

test('new conversation is only created by explicit action', async ({ page }) => {
  const notebookId = 'nb-conv-create';
  let createConversationCalls = 0;

  await page.route('**/api/v1/auth/config', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ supabaseConfigured: false, authMode: 'disabled' }),
    });
  });

  await page.route('**/api/v1/kb/notebooks**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ notebooks: [{ id: notebookId, name: 'Conversation Notebook' }] }),
    });
  });

  await page.route('**/api/v1/kb/files**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ files: [] }) });
  });

  await page.route('**/api/v1/kb/workspace-items**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [] }) });
  });

  await page.route('**/api/v1/kb/documents**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ documents: [] }) });
  });

  await page.route('**/api/v1/kb/outputs**', async (route) => {
    if (route.request().url().includes('/api/v1/kb/outputs?')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ outputs: [] }) });
      return;
    }
    await route.fallback();
  });

  await page.route('**/api/v1/kb/conversations?**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        conversations: [
          {
            id: 'conv-existing',
            notebook_id: notebookId,
            title: 'Existing thread',
            created_at: '2026-04-21T09:00:00Z',
            updated_at: '2026-04-21T10:00:00Z',
          },
        ],
      }),
    });
  });

  await page.route('**/api/v1/kb/conversations/conv-existing/messages', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        messages: [
          { id: 'm1', role: 'user', content: 'Existing question?', created_at: '2026-04-21T09:30:00Z' },
          { id: 'm2', role: 'assistant', content: 'Existing answer.', created_at: '2026-04-21T09:31:00Z' },
        ],
      }),
    });
  });

  await page.route('**/api/v1/kb/conversations', async (route) => {
    if (route.request().method() === 'POST') {
      createConversationCalls += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          conversation_id: 'conv-created',
          conversation: { id: 'conv-created', title: '新对话' },
        }),
      });
      return;
    }
    await route.fallback();
  });

  await page.goto('http://127.0.0.1:3001/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);

  await page.getByRole('button', { name: /打开笔记本|Open notebook/i }).first().click();
  await page.waitForTimeout(2500);

  await expect(page.getByText('Existing question?')).toBeVisible();
  expect(createConversationCalls).toBe(0);

  await page.locator('.thinkflow-chat-header-actions').getByRole('button', { name: /新Chat|新对话|New conversation/i }).click();
  await page.waitForTimeout(1200);

  expect(createConversationCalls).toBe(1);
  await expect(page.getByText(/请先围绕左侧已选素材提问|Ask questions around the selected sources/i)).toBeVisible();
});

test('table analysis reuses session for the same dataset without getting stuck in preparing state', async ({ page }) => {
  const notebookId = 'nb-table-analysis-session';
  const datasetPath = '/outputs/local/table-analysis_reuse_test/original/sample.csv';
  let startSessionCalls = 0;

  await page.route('**/api/v1/auth/config', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ supabaseConfigured: false, authMode: 'disabled' }),
    });
  });

  await page.route('**/api/v1/kb/notebooks**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ notebooks: [{ id: notebookId, name: 'Dataset Notebook' }] }),
    });
  });

  await page.route('**/api/v1/kb/files**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        files: [
          {
            id: 'dataset-1',
            name: 'sample.csv',
            file_path: datasetPath,
            static_url: datasetPath,
            vector_ready: true,
            vector_status: 'embedded',
            created_at: '2026-04-21T08:00:00Z',
          },
        ],
      }),
    });
  });

  await page.route('**/api/v1/kb/workspace-items**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [] }) });
  });

  await page.route('**/api/v1/kb/documents**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ documents: [] }) });
  });

  await page.route('**/api/v1/kb/outputs**', async (route) => {
    if (route.request().url().includes('/api/v1/kb/outputs?')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ outputs: [] }) });
      return;
    }
    await route.fallback();
  });

  await page.route('**/api/v1/kb/conversations?**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ conversations: [] }),
    });
  });

  await page.route('**/api/v1/data-extract/datasources/register', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        datasource: { datasource_id: 101, name: 'sample.csv', display_name: 'sample.csv' },
      }),
    });
  });

  await page.route('**/api/v1/data-extract/sessions/start', async (route) => {
    startSessionCalls += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        session: { id: `session-${startSessionCalls}` },
      }),
    });
  });

  await page.goto('http://127.0.0.1:3001/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);

  await page.getByRole('button', { name: /打开笔记本|Open notebook/i }).first().click();
  await page.waitForTimeout(1800);

  await page.getByRole('button', { name: /sample\.csv/i }).click();
  await expect(page.getByText(/已连接 sample\.csv/i)).toBeVisible();
  await expect(page.getByText(/正在准备会话/i)).not.toBeVisible({ timeout: 3000 });
  expect(startSessionCalls).toBe(1);

  const modeSwitcher = page.locator('.thinkflow-chat-header-left');
  await modeSwitcher.getByRole('button', { name: /💬 对话|对话|Chat/i }).click();
  await modeSwitcher.getByRole('button', { name: /📊 表格分析|表格分析|Table analysis/i }).click();

  await expect(page.getByText(/已连接 sample\.csv/i)).toBeVisible();
  await expect(page.getByText(/正在准备会话/i)).not.toBeVisible({ timeout: 3000 });
  expect(startSessionCalls).toBe(1);
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

test('flashcard current card persists after scrolling output workspace', async ({ page }) => {
  const notebookId = 'nb-flashcard-review';
  const outputId = 'out-flashcard-1';
  const documentId = 'doc-flashcard-review';

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
        notebooks: [{ id: notebookId, name: 'Flashcard Review Notebook' }],
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
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [] }),
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
            title: 'Flashcard document',
            content: 'Flashcard content',
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
            title: 'Flashcard document',
            content: 'Flashcard content',
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
              title: 'Flashcard review output',
              target_type: 'flashcard',
              updated_at: '2026-04-21T08:00:00Z',
              source_names: [],
              source_paths: [],
              bound_document_ids: [documentId],
              bound_document_titles: ['Flashcard document'],
              guidance_item_ids: [],
              status: 'generated',
              result: {
                flashcards: [
                  {
                    id: 'card-1',
                    question: 'First flashcard?',
                    answer: 'Answer one',
                    type: 'qa',
                  },
                  {
                    id: 'card-2',
                    question: 'Second flashcard?',
                    answer: 'Answer two',
                    type: 'qa',
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

  await expect(page.getByText('First flashcard?')).toBeVisible();
  await page.getByRole('button', { name: /下一张|Next/i }).click();
  await expect(page.getByText('Second flashcard?')).toBeVisible();

  const body = page.getByTestId('output-workspace-body');
  await body.evaluate((element) => {
    element.scrollTop = 120;
    element.dispatchEvent(new Event('scroll', { bubbles: true }));
  });

  await expect(page.getByText('Second flashcard?')).toBeVisible();
});

test('ppt uses outline chat before entering page generation workspace', async ({ page }) => {
  const notebookId = 'nb-ppt-outline-chat';
  const sourcePath = '/outputs/local/ppt-outline-chat/original/sample.pdf';
  let currentOutput = null;
  let outlineChatCalls = 0;
  let outlineApplyCalls = 0;
  let streamChatCalls = 0;
  let saveOutlineCalls = 0;
  let generateCalls = 0;
  let confirmPageCalls = 0;
  let lastOutlineChatBody = null;

  await page.route('**/api/v1/auth/config', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ supabaseConfigured: false, authMode: 'disabled' }),
    });
  });

  await page.route('**/api/v1/kb/notebooks**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ notebooks: [{ id: notebookId, name: 'PPT Notebook' }] }),
    });
  });

  await page.route('**/api/v1/kb/files**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        files: [
          {
            id: 'file-pdf-1',
            name: 'sample.pdf',
            file_path: sourcePath,
            static_url: sourcePath,
            vector_ready: true,
            vector_status: 'embedded',
            created_at: '2026-04-22T08:00:00Z',
          },
        ],
      }),
    });
  });

  await page.route('**/api/v1/kb/workspace-items**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [] }) });
  });

  await page.route('**/api/v1/kb/documents**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ documents: [] }) });
  });

  await page.route('**/api/v1/kb/outputs/out_ppt_1/outline-chat', async (route) => {
    outlineChatCalls += 1;
    lastOutlineChatBody = JSON.parse(route.request().postData() || '{}');
    await page.waitForTimeout(300);
    currentOutput = {
      ...currentOutput,
      updated_at: '2026-04-22T09:05:00Z',
      outline_chat_sessions: [
        {
          id: 'sess_1',
          status: 'active',
          messages: [
            { id: 'a0', role: 'assistant', content: '我先总结一下当前大纲思路：这版 PPT 共 2 页，你可以先提修改想法，我会整理成候选大纲。', created_at: '2026-04-22T09:00:00Z' },
            { id: 'u1', role: 'user', content: '把第 2 页改成问题背景', created_at: '2026-04-22T09:04:00Z' },
            { id: 'a1', role: 'assistant', content: '我先整理出一版候选大纲，你确认后再推送改动。', created_at: '2026-04-22T09:05:00Z' },
          ],
          draft_global_directives: [
            { id: 'gd_1', scope: 'global', type: 'title_style', label: '所有页标题使用黑色', instruction: '所有页标题使用黑色' },
          ],
          intent_summary: {
            mode: 'mixed',
            global_directives: [
              { id: 'gd_1', scope: 'global', type: 'title_style', label: '所有页标题使用黑色', instruction: '所有页标题使用黑色' },
            ],
            slide_targets: [
              { page_num: 2, instruction: '把第 2 页改成问题背景' },
            ],
          },
          draft_outline: [
            {
              id: 's1',
              pageNum: 1,
              title: '封面',
              layout_description: '论文标题与作者信息',
              key_points: ['研究主题', '作者与机构'],
              bullets: ['研究主题', '作者与机构'],
            },
            {
              id: 's2',
              pageNum: 2,
              title: '问题背景',
              layout_description: '交代现有 Transformer 编码器压缩方法的问题',
              key_points: ['现有方法延迟高', '压缩与效果难平衡'],
              bullets: ['现有方法延迟高', '压缩与效果难平衡'],
            },
            {
              id: 's3',
              pageNum: 3,
              title: '风险与限制',
              layout_description: '补充当前方案的适用边界与潜在限制',
              key_points: ['依赖任务分布稳定', '极端压缩下仍有精度损失'],
              bullets: ['依赖任务分布稳定', '极端压缩下仍有精度损失'],
            },
          ],
          has_pending_changes: true,
          created_at: '2026-04-22T09:00:00Z',
          updated_at: '2026-04-22T09:05:00Z',
        },
      ],
      outline_chat_active_session_id: 'sess_1',
      outline_chat_history: [
        { id: 'a0', role: 'assistant', content: '我先总结一下当前大纲思路：这版 PPT 共 2 页，你可以先提修改想法，我会整理成候选大纲。', created_at: '2026-04-22T09:00:00Z' },
        { id: 'u1', role: 'user', content: '把第 2 页改成问题背景', created_at: '2026-04-22T09:04:00Z' },
        { id: 'a1', role: 'assistant', content: '我先整理出一版候选大纲，你确认后再推送改动。', created_at: '2026-04-22T09:05:00Z' },
      ],
      outline_chat_draft_outline: [
        {
          id: 's1',
          pageNum: 1,
          title: '封面',
          layout_description: '论文标题与作者信息',
          key_points: ['研究主题', '作者与机构'],
          bullets: ['研究主题', '作者与机构'],
        },
        {
          id: 's2',
          pageNum: 2,
          title: '问题背景',
          layout_description: '交代现有 Transformer 编码器压缩方法的问题',
          key_points: ['现有方法延迟高', '压缩与效果难平衡'],
          bullets: ['现有方法延迟高', '压缩与效果难平衡'],
        },
        {
          id: 's3',
          pageNum: 3,
          title: '风险与限制',
          layout_description: '补充当前方案的适用边界与潜在限制',
          key_points: ['依赖任务分布稳定', '极端压缩下仍有精度损失'],
          bullets: ['依赖任务分布稳定', '极端压缩下仍有精度损失'],
        },
      ],
      outline_global_directives: [
        { id: 'gd_1', scope: 'global', type: 'title_style', label: '所有页标题使用黑色', instruction: '所有页标题使用黑色' },
      ],
      outline_chat_draft_global_directives: [
        { id: 'gd_1', scope: 'global', type: 'title_style', label: '所有页标题使用黑色', instruction: '所有页标题使用黑色' },
      ],
      outline_chat_has_pending_changes: true,
    };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        output: currentOutput,
        assistant_message: '我先整理出一版候选大纲，你确认后再推送改动。',
        applied_scope: 'outline',
        applied_slide_index: null,
        change_summary: 'draft updated',
        intent_summary: {
          mode: 'mixed',
          global_directives: [
            { id: 'gd_1', scope: 'global', type: 'title_style', label: '所有页标题使用黑色', instruction: '所有页标题使用黑色' },
          ],
          slide_targets: [
            { page_num: 2, instruction: '把第 2 页改成问题背景' },
          ],
        },
      }),
    });
  });

  await page.route('**/api/v1/kb/outputs/out_ppt_1/outline-chat/apply', async (route) => {
    outlineApplyCalls += 1;
    currentOutput = {
      ...currentOutput,
      updated_at: '2026-04-22T09:06:00Z',
      outline: currentOutput.outline_chat_draft_outline,
      outline_chat_sessions: [
        {
          ...(currentOutput.outline_chat_sessions?.[0] || {}),
          status: 'applied',
          has_pending_changes: false,
          applied_at: '2026-04-22T09:06:00Z',
        },
        {
          id: 'sess_2',
          status: 'active',
          messages: [
            { id: 'a2', role: 'assistant', content: '我先总结一下当前大纲思路：现在第 2 页已经调整成问题背景，你可以继续提新的修改想法。', created_at: '2026-04-22T09:06:00Z' },
          ],
          draft_outline: currentOutput.outline_chat_draft_outline,
          draft_global_directives: currentOutput.outline_chat_draft_global_directives,
          has_pending_changes: false,
          created_at: '2026-04-22T09:06:00Z',
          updated_at: '2026-04-22T09:06:00Z',
        },
      ],
      outline_chat_active_session_id: 'sess_2',
      outline_chat_history: [
        { id: 'a2', role: 'assistant', content: '我先总结一下当前大纲思路：现在第 2 页已经调整成问题背景，你可以继续提新的修改想法。', created_at: '2026-04-22T09:06:00Z' },
      ],
      outline_chat_draft_outline: currentOutput.outline_chat_draft_outline,
      outline_global_directives: currentOutput.outline_chat_draft_global_directives,
      outline_chat_draft_global_directives: currentOutput.outline_chat_draft_global_directives,
      outline_chat_has_pending_changes: false,
    };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        output: currentOutput,
        assistant_message: '已推送当前候选大纲，并开始新一轮对话。',
      }),
    });
  });

  await page.route('**/api/v1/kb/outputs/out_ppt_1/outline', async (route) => {
    saveOutlineCalls += 1;
    const body = JSON.parse(route.request().postData() || '{}');
    currentOutput = {
      ...currentOutput,
      outline: body.outline || currentOutput.outline,
      pipeline_stage: body.pipeline_stage || currentOutput.pipeline_stage,
      status: body.pipeline_stage || currentOutput.status,
      updated_at: '2026-04-22T09:06:00Z',
    };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, output: currentOutput }),
    });
  });

  await page.route('**/api/v1/kb/outputs/out_ppt_1/generate', async (route) => {
    generateCalls += 1;
    const generatedOutline = (currentOutput.outline || []).map((item, index) => ({
      ...item,
      generated_img_path: `/outputs/local/ppt-outline-chat/generated/page-${index + 1}.png`,
    }));
    currentOutput = {
      ...currentOutput,
      outline: generatedOutline,
      result: {
        pagecontent: generatedOutline,
        ppt_pdf_path: '/outputs/local/ppt-outline-chat/generated/slides.pdf',
        ppt_pptx_path: '/outputs/local/ppt-outline-chat/generated/slides.pptx',
      },
      page_reviews: generatedOutline.map((item, index) => ({
        page_index: index,
        page_num: item.pageNum || index + 1,
        confirmed: false,
      })),
      page_versions: generatedOutline.map((item, index) => ({
        id: `ver_${index + 1}`,
        page_index: index,
        page_num: item.pageNum || index + 1,
        title: item.title,
        preview_path: `/outputs/local/ppt-outline-chat/generated/page-${index + 1}.png`,
        selected: true,
        source: 'initial',
        created_at: '2026-04-22T09:07:00Z',
      })),
      pipeline_stage: 'pages_ready',
      status: 'pages_ready',
      updated_at: '2026-04-22T09:07:00Z',
    };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, output: currentOutput }),
    });
  });

  await page.route('**/api/v1/kb/outputs/out_ppt_1/pages/*/confirm', async (route) => {
    confirmPageCalls += 1;
    const pageIndex = Number(route.request().url().match(/pages\/(\d+)\/confirm/)?.[1] || '0');
    const nextReviews = (currentOutput.page_reviews || []).map((review, index) => (
      index === pageIndex ? { ...review, confirmed: true, confirmed_at: `2026-04-22T09:08:0${index}Z` } : review
    ));
    const allConfirmed = nextReviews.every((review) => review.confirmed);
    currentOutput = {
      ...currentOutput,
      page_reviews: nextReviews,
      pipeline_stage: allConfirmed ? 'generated' : 'pages_ready',
      status: allConfirmed ? 'generated' : 'pages_ready',
      updated_at: '2026-04-22T09:08:00Z',
    };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, output: currentOutput }),
    });
  });

  await page.route('**/api/v1/kb/outputs/outline', async (route) => {
    currentOutput = {
      id: 'out_ppt_1',
      document_id: '',
      title: 'sample.pdf · PPT',
      target_type: 'ppt',
      status: 'outline_ready',
      pipeline_stage: 'outline_ready',
      prompt: '',
      page_count: 2,
      outline: [
        {
          id: 's1',
          pageNum: 1,
          title: '封面',
          layout_description: '论文标题与作者信息',
          key_points: ['研究主题', '作者与机构'],
          bullets: ['研究主题', '作者与机构'],
        },
        {
          id: 's2',
          pageNum: 2,
          title: '旧标题',
          layout_description: '待补充背景说明',
          key_points: ['待补充 1', '待补充 2'],
          bullets: ['待补充 1', '待补充 2'],
        },
      ],
      outline_chat_sessions: [
        {
          id: 'sess_0',
          status: 'active',
          messages: [
            { id: 'a0', role: 'assistant', content: '我先总结一下当前大纲思路：这版 PPT 共 2 页，当前结构是封面 + 正文页。', created_at: '2026-04-22T09:00:00Z' },
          ],
          draft_outline: [
            {
              id: 's1',
              pageNum: 1,
              title: '封面',
              layout_description: '论文标题与作者信息',
              key_points: ['研究主题', '作者与机构'],
              bullets: ['研究主题', '作者与机构'],
            },
            {
              id: 's2',
              pageNum: 2,
              title: '旧标题',
              layout_description: '待补充背景说明',
              key_points: ['待补充 1', '待补充 2'],
              bullets: ['待补充 1', '待补充 2'],
            },
          ],
          has_pending_changes: false,
          created_at: '2026-04-22T09:00:00Z',
          updated_at: '2026-04-22T09:00:00Z',
        },
      ],
      outline_chat_active_session_id: 'sess_0',
      outline_chat_history: [
        { id: 'a0', role: 'assistant', content: '我先总结一下当前大纲思路：这版 PPT 共 2 页，当前结构是封面 + 正文页。', created_at: '2026-04-22T09:00:00Z' },
      ],
      outline_chat_draft_outline: [
        {
          id: 's1',
          pageNum: 1,
          title: '封面',
          layout_description: '论文标题与作者信息',
          key_points: ['研究主题', '作者与机构'],
          bullets: ['研究主题', '作者与机构'],
        },
        {
          id: 's2',
          pageNum: 2,
          title: '旧标题',
          layout_description: '待补充背景说明',
          key_points: ['待补充 1', '待补充 2'],
          bullets: ['待补充 1', '待补充 2'],
        },
      ],
      outline_chat_has_pending_changes: false,
      page_reviews: [],
      page_versions: [],
      source_paths: [sourcePath],
      source_names: ['sample.pdf'],
      bound_document_ids: [],
      bound_document_titles: [],
      guidance_item_ids: [],
      guidance_snapshot_text: '',
      enable_images: true,
      result: {},
      result_path: '/outputs/local/ppt-outline-chat/run_1',
      created_at: '2026-04-22T09:00:00Z',
      updated_at: '2026-04-22T09:00:00Z',
    };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, output: currentOutput }),
    });
  });

  await page.route('**/api/v1/kb/outputs?**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ outputs: currentOutput ? [currentOutput] : [] }),
    });
  });

  await page.route('**/api/v1/kb/chat/stream', async (route) => {
    streamChatCalls += 1;
    await route.fulfill({
      status: 200,
      contentType: 'text/plain',
      body: JSON.stringify({ type: 'done', answer: 'unexpected chat route' }),
    });
  });

  await page.route('**/api/v1/kb/conversations?**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        conversations: [
          {
            id: 'conv-existing',
            notebook_id: notebookId,
            title: 'Existing thread',
            created_at: '2026-04-22T08:00:00Z',
            updated_at: '2026-04-22T08:01:00Z',
          },
        ],
      }),
    });
  });

  await page.route('**/api/v1/kb/conversations/conv-existing/messages', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        messages: [
          { id: 'm1', role: 'user', content: '我想做一个偏业务汇报的 PPT', created_at: '2026-04-22T08:00:30Z' },
          { id: 'm2', role: 'assistant', content: '可以突出业务价值与结论页。', created_at: '2026-04-22T08:01:00Z' },
        ],
      }),
    });
  });

  await page.route('**/api/v1/kb/conversations', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          conversation_id: 'conv-created',
          conversation: { id: 'conv-created', title: '新对话' },
        }),
      });
      return;
    }
    await route.fallback();
  });

  await page.goto('http://127.0.0.1:3001/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);

  await page.getByRole('button', { name: /打开笔记本|Open notebook/i }).first().click();
  await page.waitForTimeout(2500);

  await page.locator('.thinkflow-output-toolbar').getByRole('button', { name: /^PPT$/ }).click();
  await expect(page.getByRole('heading', { name: '确认本次 PPT 来源' })).toBeVisible();
  await page.getByRole('button', { name: '确认并生成大纲' }).click();

  await expect(page.locator('body')).toContainText(/大纲确认|Outline review/i);
  await expect(page.locator('body')).toContainText('旧标题');

  const chatInput = page.locator('.thinkflow-chat-input');
  await chatInput.fill('把第 2 页改成问题背景');
  await page.locator('.thinkflow-send-btn').click();

  await expect(page.locator('body')).toContainText('把第 2 页改成问题背景');
  await expect(page.locator('body')).toContainText(/正在基于来源整理候选大纲|正在整理候选大纲/i);
  await expect(page.locator('body')).toContainText('问题背景');
  await expect(page.locator('body')).toContainText('风险与限制');
  await expect(page.locator('body')).toContainText(/推送改动|Organize出一版候选大纲|整理出一版候选大纲/i);
  await expect(page.locator('body')).toContainText('当前生效规则');
  await expect(page.locator('body')).toContainText('所有页标题使用黑色');
  await expect(page.locator('.thinkflow-message-row.assistant').last()).toContainText('候选改动对比');
  await expect(page.locator('body')).toContainText('新增 1 页');
  await expect(page.locator('body')).toContainText('修改 1 页');
  await expect(page.locator('body')).toContainText('第 2 页');
  await expect(page.locator('body')).toContainText('旧标题');
  expect(outlineChatCalls).toBe(1);
  expect(streamChatCalls).toBe(0);
  expect(lastOutlineChatBody.message).toBe('把第 2 页改成问题背景');
  expect(lastOutlineChatBody.active_slide_index).toBe(0);
  expect(Array.isArray(lastOutlineChatBody.conversation_history)).toBe(true);
  expect(lastOutlineChatBody.conversation_history[0].content).toBe('我想做一个偏业务汇报的 PPT');
  await expect(page.getByRole('button', { name: /推送这版|推送改动/ }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /推送这版|推送改动/ })).toHaveCount(1);
  await expect(page.getByRole('button', { name: /确认大纲，进入逐页生成|Confirm outline and generate pages/i }).first()).toBeDisabled();

  await page.getByRole('button', { name: /推送这版|推送改动/ }).first().click();
  await expect(page.locator('body')).toContainText(/现在第 2 页已经调整成问题背景|新一轮对话/i);
  await expect(page.locator('body')).not.toContainText('候选改动对比');
  expect(outlineApplyCalls).toBe(1);

  await page.getByRole('button', { name: /确认大纲，进入逐页生成|Confirm outline and generate pages/i }).first().click();
  await expect(page.locator('body')).toContainText(/逐页生成确认|Page review/i);
  expect(saveOutlineCalls).toBeGreaterThan(0);

  await page.getByRole('button', { name: /生成每页结果|Generate page results/i }).first().click();
  await expect(page.locator('body')).toContainText(/第 1 页核对与改单页|Page 1/i);
  await expect(page.locator('body')).toContainText(/待核对|Pending review/i);
  expect(generateCalls).toBe(1);

  await page.getByRole('button', { name: /确认当前页并继续|Confirm current page and continue/i }).click();
  await expect(page.locator('body')).toContainText(/第 1 页已确认/);
  await page.getByRole('button', { name: /确认当前页并继续|Confirm current page and continue/i }).click();
  await expect(page.locator('body')).toContainText(/第 2 页已确认/);
  await page.getByRole('button', { name: /确认当前页并完成|Confirm current page and finish/i }).click();
  await expect(page.locator('body')).toContainText(/生成结果|Generated result/i);
  await expect(page.locator('body')).toContainText(/下载 PPTX|Download PPTX/i);
  expect(confirmPageCalls).toBe(3);
});
