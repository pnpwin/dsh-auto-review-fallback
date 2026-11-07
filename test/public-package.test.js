import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { requireHarnessModule } from '../host-runtime.js';
import { withCodexCompatibility } from '../codex-compat.js';
import { createReviewHandler } from '../router.js';

function resolver(works, { executionError } = {}) {
  const seen = [];
  const makeRequire = anchor => {
    const fn = resolved => {
      assert.equal(resolved, `resolved:${anchor}`);
      if (executionError) throw executionError;
      return { anchor };
    };
    fn.resolve = specifier => {
      assert.equal(specifier, '@deepseek-ai/schemastery');
      seen.push(anchor);
      if (!works(anchor)) throw Object.assign(new Error('not found'), { code: 'MODULE_NOT_FOUND' });
      return `resolved:${anchor}`;
    };
    return fn;
  };
  return { seen, makeRequire };
}
const environment = { resourcesPath: undefined, entryPath: '/runtime/dsh-entry.js', realpath: value => value, moduleUrl: 'file:///plugin/host-runtime.js' };

test('runtime loader prefers the actual Desktop resources directory', () => {
  const mock = resolver(() => true);
  const result = requireHarnessModule('@deepseek-ai/schemastery', { ...environment, resourcesPath: '/runtime/resources', makeRequire: mock.makeRequire });
  assert.ok(result.anchor.endsWith('/app.asar/dsh/package.json'));
  assert.equal(mock.seen.length, 1);
});

test('runtime loader supports a CLI entry anchor without a fixed macOS path', () => {
  const mock = resolver(anchor => anchor === environment.entryPath);
  const result = requireHarnessModule('@deepseek-ai/schemastery', { ...environment, makeRequire: mock.makeRequire });
  assert.equal(result.anchor, environment.entryPath);
});

test('runtime loader falls back to ordinary package resolution', () => {
  const mock = resolver(anchor => anchor === environment.moduleUrl);
  const result = requireHarnessModule('@deepseek-ai/schemastery', { ...environment, makeRequire: mock.makeRequire });
  assert.equal(result.anchor, environment.moduleUrl);
  assert.equal(mock.seen.length, 2);
});

test('runtime loader reports missing runtime and rejects arbitrary imports', () => {
  const mock = resolver(() => false);
  assert.throws(() => requireHarnessModule('@deepseek-ai/schemastery', { ...environment, makeRequire: mock.makeRequire }), { code: 'DSH_RUNTIME_NOT_FOUND' });
  assert.throws(() => requireHarnessModule('not-a-dsh-module'), /Unsupported Harness runtime import/);
});

test('runtime loader does not mask errors thrown by an existing module', () => {
  const error = new Error('module execution failure');
  const mock = resolver(() => true, { executionError: error });
  assert.throws(() => requireHarnessModule('@deepseek-ai/schemastery', { ...environment, makeRequire: mock.makeRequire }), e => e === error);
  assert.equal(mock.seen.length, 1);
});

const chunks = [{ type: 'finish', reason: { kind: 'error', failure: { code: 'TEST_DENY', message: 'unchanged' } } }];
const collect = async stream => { const values = []; for await (const value of stream) values.push(value); return values; };

test('session-mode Codex compatibility re-enters once and preserves frozen input', async () => {
  let listener;
  let dispatches = 0;
  let sent;
  const request = Object.freeze({ purpose: 'auto-review', provider: 'openai-codex', model: 'test-model', temperature: 0,
    system: 'policy', messages: [], signal: new AbortController().signal, sessionId: 'test' });
  const stream = options => listener(options, () => (async function* () {
    dispatches++; sent = options;
    if (Object.hasOwn(options, 'temperature')) throw new Error('Unsupported parameter: temperature');
    yield* chunks;
  })());
  const handler = createReviewHandler({ stream, readRouting: () => ({ mode: 'session', routes: [], timeoutMs: 1000 }) });
  listener = withCodexCompatibility(handler, stream);
  assert.deepEqual(await collect(stream(request)), chunks);
  assert.equal(dispatches, 1);
  assert.equal(Object.hasOwn(sent, 'temperature'), false);
  assert.equal(request.temperature, 0);
  for (const key of Object.keys(request).filter(key => key !== 'temperature')) assert.equal(sent[key], request[key]);
});

test('Codex compatibility does not affect unrelated requests or already-compatible options', () => {
  const sentinel = {};
  const listener = withCodexCompatibility((options, next) => next(), () => { throw new Error('unexpected redispatch'); });
  for (const options of [
    { purpose: 'agent-loop', provider: 'openai-codex', temperature: 0 },
    { purpose: 'auto-review', provider: 'another-provider', temperature: 0 },
    { purpose: 'auto-review', provider: 'openai-codex' },
  ]) assert.equal(listener(options, () => sentinel), sentinel);
});

test('published package identity, metadata and runtime files are consistent', async () => {
  const root = new URL('../', import.meta.url);
  const pkg = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));
  const client = await readFile(new URL('client.js', root), 'utf8');
  const patch = await readFile(new URL('cordis.patch.yml', root), 'utf8');
  assert.equal(pkg.name, '@pnpwin/dsh-auto-review-fallback');
  assert.equal(pkg.license, 'MIT');
  assert.ok(client.includes(`id: '${pkg.name}'`));
  assert.ok(client.includes("const SETTINGS_NS = 'pnpwin-auto-review-fallback'"));
  assert.ok(patch.includes(`name: '${pkg.name}'`));
  assert.ok(patch.includes('id: pnpwin-auto-review-fallback'));
  for (const locale of ['en','ru']) {
    const data = JSON.parse(await readFile(new URL(`locale/${locale}.json`, root),'utf8'));
    assert.ok(data.meta.title && data.meta.description);
  }
  for (const path of ['host.js','host-runtime.js','codex-compat.js','router.js','client.js']) {
    const text = await readFile(new URL(path, root),'utf8');
    assert.ok(!text.includes('/Users/'));
    assert.ok(!text.includes('/Applications/DeepSeek Harness.app'));
    assert.ok(pkg.files.includes(path));
  }
});
