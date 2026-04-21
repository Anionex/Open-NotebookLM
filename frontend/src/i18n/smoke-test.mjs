import { strict as assert } from 'node:assert';

const [translatorResponse, switcherResponse] = await Promise.all([
  fetch('http://127.0.0.1:3001/src/i18n/domTranslator.ts'),
  fetch('http://127.0.0.1:3001/src/i18n/LanguageSwitcher.tsx'),
]);

assert.equal(translatorResponse.ok, true, 'domTranslator.ts should be served by Vite');
assert.equal(switcherResponse.ok, true, 'LanguageSwitcher.tsx should be served by Vite');

const translatorSource = await translatorResponse.text();
const switcherSource = await switcherResponse.text();
assert.match(translatorSource, /Knowledge Workspace/, 'English Dashboard headline translation should exist');
assert.match(translatorSource, /translateDom/, 'DOM translation entrypoint should exist');
assert.match(switcherSource, /Switch to Chinese/, 'English language toggle label should exist');

console.log('i18n smoke checks passed');
