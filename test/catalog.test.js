import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

const source = await readFile(new URL('../client.js', import.meta.url), 'utf8');
const start = source.indexOf('    function joinSettingsModels(');
const end = source.indexOf('    // End pure Settings catalog projection.', start);
assert.ok(start >= 0 && end > start);
// Exercise only the actual pure catalog projection. No React or DOM is emulated.
const project = runInNewContext(`${source.slice(start, end)}\njoinSettingsModels`);
const join = (...args) => JSON.parse(JSON.stringify(project(...args)));
const registered = [
  { id: 'deepseek-official', name: 'DeepSeek' },
  { id: 'deepseek-account', name: 'DeepSeek Account' },
  { id: 'openai-codex', name: 'Codex' },
  { id: 'lmstudio', name: 'LM Studio' },
];
const directory = [
  { provider: 'deepseek-official', displayName: 'DeepSeek', settingsNs: 'ds', settingsPath: [] },
  { provider: 'deepseek-account', displayName: 'DeepSeek Account', settingsNs: 'account', settingsPath: [] },
  { provider: 'openai-codex', displayName: 'OpenAI (ChatGPT Pro)', settingsNs: 'pi', settingsPath: ['providers', 'openai-codex'] },
  { provider: 'lmstudio', displayName: 'LM Studio (LAN)', settingsNs: 'pi', settingsPath: ['providers', 'lmstudio'] },
  { provider: 'unconfigured', displayName: 'Unconfigured template', settingsNs: 'pi', settingsPath: ['providers', 'unconfigured'] },
];
const described = { namespaces: [
  { ns: 'ds', value: {} }, { ns: 'account', value: {} },
  { ns: 'pi', value: { providers: {
    'openai-codex': { displayName: 'OpenAI (ChatGPT Pro)', apiKeyEnv: 'DO_NOT_EXPORT', models: [{ id: 'gpt-light' }] },
    lmstudio: { displayName: 'LM Studio (LAN)', baseURL: 'http://PRIVATE_HOST', models: [{ id: 'local/model', name: 'Local model' }] },
  } } },
] };
const modelCatalog = { groups: [
  { id: 'deepseek-official', models: [{ id: 'flash', name: 'Flash' }] },
  { id: 'deepseek-account', models: [{ id: 'account-flash', name: 'Account Flash' }] },
  { id: 'openai-codex', models: [{ id: 'gpt-light', name: 'GPT Light' }, { id: 'gpt-heavy', name: 'GPT Heavy' }] },
  { id: 'lmstudio', models: [{ id: 'local/model', name: 'Local model' }] },
], failures: [] };

test('includes all four connected providers from Settings Models, not just DeepSeek', () => {
  const rows = join(registered, directory, described, modelCatalog);
  assert.deepEqual(rows.map(row => row.id), ['deepseek-account', 'deepseek-official', 'openai-codex', 'lmstudio']);
  assert.equal(rows.find(row => row.id === 'openai-codex').name, 'OpenAI (ChatGPT Pro)');
  assert.equal(rows.find(row => row.id === 'lmstudio').name, 'LM Studio (LAN)');
  assert.deepEqual(rows.find(row => row.id === 'openai-codex').models.map(m => m.id), ['gpt-light', 'gpt-heavy']);
});

test('does not expose provider credentials, refs, private URLs or whole profiles', () => {
  const text = JSON.stringify(join(registered, directory, described, modelCatalog));
  assert.ok(!text.includes('DO_NOT_EXPORT'));
  assert.ok(!text.includes('PRIVATE_HOST'));
  assert.ok(!text.includes('apiKeyEnv'));
});

test('catalog failure retains configured providers and saved model IDs', () => {
  const rows = join(registered, directory, described, { groups: [], failures: [] });
  assert.equal(rows.length, 4);
  assert.deepEqual(rows.find(row => row.id === 'openai-codex').models, [{ id: 'gpt-light', name: 'gpt-light' }]);
  assert.deepEqual(rows.find(row => row.id === 'lmstudio').models, [{ id: 'local/model', name: 'Local model' }]);
});

test('configured but currently unregistered provider remains visible with an error', () => {
  const rows = join(registered.filter(p => p.id !== 'lmstudio'), directory, described, modelCatalog);
  assert.equal(rows.find(row => row.id === 'lmstudio').error, 'Model catalog unavailable');
});

test('installed but unconfigured provider templates are not listed', () => {
  assert.ok(!join(registered, directory, described, modelCatalog).some(p => p.id === 'unconfigured'));
});

test('registered provider without a configurable settings address is retained', () => {
  const rows = join([...registered, { id: 'extra', name: 'Extra provider' }], directory, described, modelCatalog);
  assert.equal(rows.at(-1).id, 'extra');
  assert.equal(rows.at(-1).name, 'Extra provider');
});

test('profile display name overrides stale directory labels', () => {
  const rows = join(registered, directory.map(d => ({ ...d, displayName: 'stale' })), described, modelCatalog);
  assert.equal(rows.find(row => row.id === 'lmstudio').name, 'LM Studio (LAN)');
});

test('catalog updates reflect changed settings without modifying saved route objects', () => {
  const old = structuredClone(described);
  const edited = structuredClone(described);
  edited.namespaces.find(n => n.ns === 'pi').value.providers.lmstudio.displayName = 'New LAN label';
  assert.equal(join(registered, directory, edited, modelCatalog).find(p => p.id === 'lmstudio').name, 'New LAN label');
  assert.deepEqual(described, old);
});

test('duplicates are removed by provider/model IDs, not display name', () => {
  const rows = join([...registered, ...registered], [...directory, ...directory], described, {
    groups: [{ id: 'openai-codex', models: [{ id: 'x', name: 'Same' }, { id: 'x', name: 'Duplicate' }, { id: 'y', name: 'Same' }] }], failures: [],
  });
  assert.equal(rows.length, 4);
  assert.deepEqual(rows.find(p => p.id === 'openai-codex').models, [{ id: 'x', name: 'Same' }, { id: 'y', name: 'Same' }]);
});

test('provider failure does not hide unrelated providers or expose raw error messages', () => {
  const rows = join(registered, directory, described, { ...modelCatalog, failures: [{ id: 'lmstudio', message: 'PRIVATE error details' }] });
  assert.equal(rows.length, 4);
  assert.equal(rows.find(p => p.id === 'lmstudio').error, 'Model catalog unavailable');
  assert.ok(!JSON.stringify(rows).includes('PRIVATE error details'));
});

test('invalid required directory responses reject instead of silently listing only one provider', () => {
  assert.throws(() => join(null, directory, described, modelCatalog), /Invalid Models/);
  assert.throws(() => join(registered, null, described, modelCatalog), /Invalid Models/);
  assert.throws(() => join(registered, directory, {}, modelCatalog), /Invalid Models/);
});

test('UI uses a full select, not datalist filtering against the currently selected provider', () => {
  assert.ok(!source.includes("h('datalist'"));
  assert.ok(source.includes("field(t('provider'), h('select'"));
  assert.ok(source.includes("...catalog.map(item => h('option'"));
  assert.ok(source.includes('ctx.remote.llm.listConfigurableProviders()'));
  assert.ok(source.includes('ctx.remote.session.modelCatalog()'));
  assert.ok(!source.includes("fetch('/api/local-auto-review-router/catalog'"));
});
