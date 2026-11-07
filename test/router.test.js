import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { createReviewHandler, normalizeRouting, isAvailabilityFailure } from '../src/router.js';

const route = (model, extra = {}) => ({ provider: 'provider', model, reasoningEffort: '', ...extra });
const chain = (routes = [route('primary'), route('fallback')], extra = {}) => ({ mode: 'chain', routes, timeoutMs: 1000, ...extra });
const finish = (kind = 'stop', failure) => ({ type: 'finish', reason: { kind, ...(failure ? { failure } : {}) } });
const unavailable = (code = 'NETWORK', extra = {}) => finish('error', { code, message: 'provider-private-message', ...extra });
const text = (value, end = finish()) => [
  { type: 'block-start', block: { type: 'text', id: 'answer' } },
  { type: 'block-delta', id: 'answer', delta: value },
  { type: 'block-end', block: { type: 'text', id: 'answer', text: value } },
  end,
];
const source = async function* (chunks) { yield* chunks; };
const collect = async iterable => { const chunks = []; for await (const chunk of iterable) chunks.push(chunk); return chunks; };
const deferred = () => { let resolve; let reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const never = () => new Promise(() => {});
const options = (extra = {}) => ({
  purpose: 'auto-review', provider: 'session-provider', model: 'session-model',
  temperature: 0.7, reasoningEffort: 'session-effort', sessionId: 'session-id',
  messages: [{ role: 'user', content: 'unchanged policy-sensitive request' }],
  policy: { mode: 'deny-by-default' }, tools: [{ name: 'review' }],
  custom: { keep: true }, ...extra,
});
function harness({ routing = chain(), respond = () => source(text('{"allow":true}')), spread = true, signal, cleanupMs = 20, onAttempt } = {}) {
  const calls = [];
  const attempts = [];
  let reads = 0;
  let passthrough = 0;
  const handler = createReviewHandler({
    readRouting: () => { reads++; return typeof routing === 'function' ? routing() : routing; },
    stream: request => {
      calls.push(request);
      // Simulate llm.stream's waterfall middleware, including an ordinary spread.
      return handler(spread ? { ...request } : request, () => respond(request, calls.length - 1));
    },
    signal, cleanupMs, onAttempt: info => { attempts.push(info); onAttempt?.(info); },
  });
  return { handler, calls, attempts, get reads() { return reads; }, get passthrough() { return passthrough; },
    run: (request = options()) => handler(request, () => { passthrough++; return source(text('session')); }),
  };
}
function assertFailure(chunks, code, kind = 'error') {
  assert.equal(chunks.length, 1, 'failure must not release buffered answer fragments');
  assert.equal(chunks[0].type, 'finish');
  assert.equal(chunks[0].reason.kind, kind);
  assert.equal(chunks[0].reason.failure.code, code);
}

describe('normalizeRouting', () => {
  test('normalizes, snapshots and deeply freezes routing entries', () => {
    const input = chain([route(' model ', { provider: ' provider ', reasoningEffort: ' high ' })]);
    const result = normalizeRouting(input);
    assert.deepEqual(result, chain([route('model', { reasoningEffort: 'high' })]));
    input.routes[0].model = 'changed';
    input.routes.push(route('new'));
    assert.equal(result.routes[0].model, 'model');
    assert.equal(result.routes.length, 1);
    for (const value of [result, result.routes, result.routes[0]]) assert.ok(Object.isFrozen(value));
  });
  test('accepts session mode without routes, timeout bounds, and eight distinct routes', () => {
    assert.equal(normalizeRouting({ mode: 'session', routes: [], timeoutMs: 1000 }).mode, 'session');
    assert.equal(normalizeRouting(chain(Array.from({ length: 8 }, (_, i) => route(String(i))), { timeoutMs: 120000 })).routes.length, 8);
    assert.equal(normalizeRouting(chain([{ provider: 'p', model: 'm' }])).routes[0].reasoningEffort, '');
  });
  for (const [label, value] of [
    ['missing config', undefined], ['unknown mode', chain(undefined, { mode: 'other' })],
    ['missing routes', { mode: 'chain', timeoutMs: 1000 }], ['non-array routes', chain({}, {})],
    ['empty chain', chain([])], ['nine routes', chain(Array.from({ length: 9 }, (_, i) => route(String(i))))],
    ['duplicate pair', chain([route('same'), route('same')])],
    ['trimmed duplicate pair', chain([route('same'), route(' same ', { provider: ' provider ' })])],
    ['blank provider', chain([route('m', { provider: ' ' })])], ['blank model', chain([route(' ')])],
    ['non-string provider', chain([route('m', { provider: 3 })])], ['non-string model', chain([route(3)])],
    ['null route', chain([null])], ['oversized provider', chain([route('m', { provider: 'p'.repeat(201) })])],
    ['oversized model', chain([route('m'.repeat(301))])], ['invalid effort type', chain([route('m', { reasoningEffort: 3 })])],
    ['oversized effort', chain([route('m', { reasoningEffort: 'h'.repeat(65) })])],
    ...[0, 999, 120001, 1000.5, '1000', NaN, Infinity, undefined].map(timeoutMs => [`invalid timeout ${timeoutMs}`, chain(undefined, { timeoutMs })]),
  ]) test(`rejects ${label}`, () => assert.throws(() => normalizeRouting(value)));
  test('allows the same model on different providers without conflating pairs', () => {
    assert.equal(normalizeRouting(chain([route('same'), route('same', { provider: 'other' })])).routes.length, 2);
  });
});

describe('availability classifier', () => {
  for (const code of ['RATE_LIMIT', 'QUOTA', 'SERVER', 'TIMEOUT', 'TRANSPORT', 'NETWORK', 'NO_ADAPTER', 'UNKNOWN_MODEL', 'MISSING_CREDENTIAL', 'INVALID_CREDENTIAL', 'AUTH', 'ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN', 'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_SOCKET', 'UND_ERR_HEADERS_TIMEOUT']) {
    test(`permits technical fallback for ${code}`, () => { assert.equal(isAvailabilityFailure({ code }), true); assert.equal(isAvailabilityFailure({ code: code.toLowerCase() }), true); });
  }
  for (const code of ['ABORTED', 'SAFETY', 'CONTENT_FILTER', 'POLICY_VIOLATION', 'INVALID_REQUEST', 'UNSUPPORTED_OPTION', 'UNSUPPORTED_REASONING_EFFORT', 'REVIEW_PROTOCOL', 'REVIEW_BUFFER_LIMIT', 'REVIEW_DRAIN_FAILED']) {
    test(`never reclassifies ${code} using a retryable HTTP status`, () => assert.equal(isAvailabilityFailure({ code, status: 503 }), false));
  }
  test('recognizes explicit technical HTTP status but does not guess from messages', () => {
    for (const status of [401, 429, 500, 502, 503, 504]) assert.equal(isAvailabilityFailure({ status }), true);
    for (const value of [undefined, null, {}, { status: '503' }, { status: 403 }, { status: 400 }, { code: 'UNKNOWN' }, { message: 'timeout rate limit 503' }]) assert.equal(isAvailabilityFailure(value), false);
  });
});

describe('routing and safety', { concurrency: true }, () => {
  test('non-review requests pass through without reading settings or preparing a model', () => {
    const sentinel = source([]);
    const handler = createReviewHandler({ stream: () => assert.fail('must not route'), readRouting: () => assert.fail('must not read settings') });
    assert.equal(handler(options({ purpose: 'chat' }), () => sentinel), sentinel);
  });
  test('session mode prepares the session model once, retaining its controls and without fallback', async () => {
    const request = options();
    const h = harness({routing:{mode:'session',routes:[route('not-used')],timeoutMs:1000}});
    assert.deepEqual(await collect(h.run(request)),text('{"allow":true}'));
    assert.equal(h.calls.length,1);assert.equal(h.reads,1);assert.equal(h.passthrough,0);
    for (const key of Object.keys(request).filter(key=>key!=='signal')) assert.equal(h.calls[0][key],request[key]);
    const failed=harness({routing:{mode:'session',routes:[],timeoutMs:1000},respond:()=>source([unavailable('AUTH')])});
    assert.deepEqual(await collect(failed.run()),[unavailable('AUTH')]);assert.equal(failed.calls.length,1);
  });
  for (const spread of [false, true]) test(`private symbol prevents recursive rerouting with ${spread ? 'spread' : 'identical'} middleware options`, async () => {
    const h = harness({ spread });
    assert.deepEqual(await collect(h.run()), text('{"allow":true}'));
    assert.equal(h.calls.length, 1);
    assert.equal(h.reads, 1);
    const symbols = Object.getOwnPropertySymbols(h.calls[0]);
    assert.equal(symbols.length, 1);
    assert.equal(Object.getOwnPropertyDescriptor(h.calls[0], symbols[0]).enumerable, true);
    assert.ok(!JSON.stringify(h.calls[0]).includes('local-auto-review-route'));
  });
  test('reroutes preserve policy/history/session and strip sampling plus inherited effort', async () => {
    const original = options();
    const originalCopy = { ...original };
    const h = harness({ routing: chain([route('primary'), route('fallback', { provider: 'other', reasoningEffort: 'high' })]), respond: (_, i) => source(i ? text('{"allow":true}') : [unavailable()]) });
    await collect(h.run(original));
    assert.equal(h.calls.length, 2);
    for (const request of h.calls) {
      for (const key of ['messages', 'policy', 'sessionId', 'purpose', 'tools', 'custom']) assert.equal(request[key], original[key]);
      assert.equal('temperature' in request, false);
      assert.ok(Object.isFrozen(request));
      assert.ok(request.signal instanceof AbortSignal);
    }
    assert.equal('reasoningEffort' in h.calls[0], false);
    assert.equal(h.calls[1].reasoningEffort, 'high');
    assert.deepEqual(h.calls.map(({ provider, model }) => [provider, model]), [['provider', 'primary'], ['other', 'fallback']]);
    assert.deepEqual(original, originalCopy);
  });
  for (const answer of ['{"allow":true}', '{"allow":false}', 'not valid JSON', '', '{"unexpected":"shape"}']) test(`never model-shops a completed stop answer ${JSON.stringify(answer)}`, async () => {
    const chunks = text(answer);
    const h = harness({ respond: () => source(chunks) });
    assert.deepEqual(await collect(h.run()), chunks);
    assert.equal(h.calls.length, 1);
  });
  for (const kind of ['max-tokens', 'aborted', 'tool-calls', 'stop']) test(`does not retry terminal ${kind}`, async () => {
    const chunks = [finish(kind, kind === 'aborted' ? { code: 'ABORTED', message: 'Provider aborted' } : undefined)];
    const h = harness({ respond: () => source(chunks) });
    assert.deepEqual(await collect(h.run()), chunks);
    assert.equal(h.calls.length, 1);
  });
  for (const code of ['SAFETY', 'CONTENT_FILTER', 'POLICY_VIOLATION', 'INVALID_REQUEST', 'UNSUPPORTED_OPTION', 'UNSUPPORTED_REASONING_EFFORT', 'ABORTED', 'UNKNOWN']) test(`does not retry error ${code}`, async () => {
    const terminal = unavailable(code, { status: code === 'UNKNOWN' ? 400 : 503 });
    const h = harness({ respond: () => source([terminal]) });
    assert.deepEqual(await collect(h.run()), [terminal]);
    assert.equal(h.calls.length, 1);
  });
  test('a completed text answer followed by an availability error never causes fallback', async () => {
    const chunks = text('{"allow":false}', unavailable());
    const h = harness({ respond: () => source(chunks) });
    assert.deepEqual(await collect(h.run()), chunks);
    assert.equal(h.calls.length, 1);
  });
  test('discards every fragment from an unavailable attempt before yielding fallback', async () => {
    const partial = [{ type: 'block-delta', delta: 'PRIVATE-PARTIAL-DENIAL' }, unavailable()];
    const h = harness({ respond: (_, i) => source(i ? text('{"allow":false}') : partial) });
    const output = await collect(h.run());
    assert.deepEqual(output, text('{"allow":false}'));
    assert.ok(!JSON.stringify(output).includes('PRIVATE-PARTIAL-DENIAL'));
    assert.equal(h.calls.length, 2);
    assert.equal(h.reads, 1);
  });
  test('holds all successful chunks until the entire iterator terminates', async () => {
    const finishGate = deferred();
    const started = deferred();
    const h = harness({ respond: async function* () { yield* text('{"allow":false}'); started.resolve(); await finishGate.promise; } });
    const iterator = h.run()[Symbol.asyncIterator]();
    let released = false;
    const first = iterator.next().then(result => { released = true; return result; });
    await started.promise;
    assert.equal(released, false);
    finishGate.resolve();
    assert.deepEqual((await first).value, text('{"allow":false}')[0]);
    await collect({ [Symbol.asyncIterator]: () => iterator });
  });
  test('all exhausted routes emit one synthetic terminal with no fragments or provider error text', async () => {
    const h = harness({ routing: chain([route('one'), route('two'), route('three')]), respond: () => source([{ type: 'block-delta', delta: 'PRIVATE-FRAGMENT' }, unavailable('RATE_LIMIT')]) });
    const output = await collect(h.run());
    assertFailure(output, 'AUTO_REVIEW_ROUTES_EXHAUSTED');
    assert.equal(h.calls.length, 3);
    assert.equal(h.attempts.length, 3);
    assert.ok(!JSON.stringify(output).includes('PRIVATE-FRAGMENT'));
    assert.ok(!JSON.stringify(output).includes('provider-private-message'));
  });
  test('pi-ai AUTH without an HTTP status falls back, but never after a completed answer', async () => {
    const h = harness({ respond: (_, i) => source(i ? text('{"risk":"low","decision":"allow"}') : [unavailable('AUTH')]) });
    assert.deepEqual(await collect(h.run()), text('{"risk":"low","decision":"allow"}'));
    assert.equal(h.calls.length, 2);
    const answered = harness({ respond: () => source(text('{"risk":"high","decision":"deny"}', unavailable('AUTH'))) });
    assert.deepEqual(await collect(answered.run()), text('{"risk":"high","decision":"deny"}', unavailable('AUTH')));
    assert.equal(answered.calls.length, 1);
  });
  test('unknown thrown errors fail closed without fallback or secret details', async () => {
    const h = harness({ respond: () => { throw new Error('SECRET provider credentials and request'); } });
    const output = await collect(h.run());
    assertFailure(output, 'REVIEW_INTERNAL_ERROR');
    assert.equal(h.calls.length, 1);
    assert.ok(!JSON.stringify(output).includes('SECRET'));
  });
  test('technical thrown errors can fall back, including synchronous adapter failures', async () => {
    const h = harness({ respond: (_, i) => { if (!i) throw Object.assign(new Error('SECRET'), { code: 'NO_ADAPTER' }); return source(text('safe')); } });
    assert.deepEqual(await collect(h.run()), text('safe'));
    assert.equal(h.calls.length, 2);
  });
  test('exception after a completed text block never retries and releases no partial chunks', async () => {
    const h = harness({ respond: async function* () { yield* text('PRIVATE').slice(0, -1); throw Object.assign(new Error('hidden'), { code: 'NETWORK' }); } });
    assertFailure(await collect(h.run()), 'NETWORK');
    assert.equal(h.calls.length, 1);
  });
  test('attempt telemetry contains routing metadata only, not policy/history/provider secrets', async () => {
    const h = harness({ respond: (_, i) => source(i ? text('safe') : [unavailable()]) });
    await collect(h.run());
    assert.deepEqual(h.attempts, [
      { sessionId: 'session-id', provider: 'provider', model: 'primary', index: 0, outcome: 'error', code: 'NETWORK' },
      { sessionId: 'session-id', provider: 'provider', model: 'fallback', index: 1, outcome: 'stop' },
    ]);
  });
  test('configuration is snapshotted before consumption and refreshed only for a new request', async () => {
    const config = chain([route('old-primary'), route('old-fallback')]);
    const h = harness({ routing: config, respond: request => source(request.model.endsWith('primary') ? [unavailable()] : text(request.model)) });
    const running = h.run();
    config.routes[0].model = 'new-primary';
    config.routes[1].model = 'new-fallback';
    assert.deepEqual(await collect(running), text('old-fallback'));
    assert.deepEqual(await collect(h.run()), text('new-fallback'));
    assert.deepEqual(h.calls.map(request => request.model), ['old-primary', 'old-fallback', 'new-primary', 'new-fallback']);
    assert.equal(h.reads, 2);
  });
  test('concurrent request cancellation does not corrupt another review or its fallback state', async () => {
    const cancel = new AbortController();
    const started = deferred();
    const h = harness({ respond: request => {
      if (request.sessionId === 'cancelled') return {
        [Symbol.asyncIterator]() { return this; },
        next() { started.resolve(); return new Promise(resolve => request.signal.addEventListener('abort', () => resolve({ done: true }), { once: true })); },
        return() { return Promise.resolve({ done: true }); },
      };
      return source(request.model === 'primary' ? [unavailable()] : text('other-review'));
    } });
    const first = collect(h.run(options({ sessionId: 'cancelled', signal: cancel.signal })));
    await started.promise;
    const second = collect(h.run(options({ sessionId: 'healthy' })));
    cancel.abort();
    const [cancelled, healthy] = await Promise.all([first, second]);
    assertFailure(cancelled, 'ABORTED', 'aborted');
    assert.deepEqual(healthy, text('other-review'));
    assert.equal(h.calls.filter(request => request.sessionId === 'cancelled').length, 1);
    assert.equal(h.calls.filter(request => request.sessionId === 'healthy').length, 2);
    assert.equal(h.reads, 2);
  });
});

describe('protocol and memory bounds', { concurrency: true }, () => {
  for (const [label, chunks] of [
    ['missing terminal', [{ type: 'block-delta', delta: 'PRIVATE' }]],
    ['null chunk', [null]], ['missing chunk type', [{}]],
    ['data after finish', [finish(), { type: 'block-delta', delta: 'PRIVATE' }]],
    ['duplicate finish', [finish(), finish()]],
  ]) test(`rejects ${label} without retry or buffered data`, async () => {
    const h = harness({ respond: () => source(chunks) });
    assertFailure(await collect(h.run()), 'REVIEW_PROTOCOL');
    assert.equal(h.calls.length, 1);
  });
  test('bounds total serialized buffer bytes without fallback or partial output', async () => {
    const h = harness({ respond: () => source([{ type: 'block-delta', delta: 'x'.repeat(1024 * 1024 + 1) }, finish()]) });
    assertFailure(await collect(h.run()), 'REVIEW_BUFFER_LIMIT');
    assert.equal(h.calls.length, 1);
  });
  test('bounds chunk count even when each chunk is small', async () => {
    const h = harness({ respond: async function* () { for (let i = 0; i < 20001; i++) yield { type: 'small' }; yield finish(); } });
    assertFailure(await collect(h.run()), 'REVIEW_BUFFER_LIMIT');
    assert.equal(h.calls.length, 1);
  });
  for (const [label, terminal] of [
    ['missing reason', { type: 'finish' }], ['null reason', { type: 'finish', reason: null }],
    ['missing kind', { type: 'finish', reason: {} }], ['unknown kind', finish('provider-invented-kind')],
    ['error missing failure', finish('error')], ['abort missing failure', finish('aborted')],
    ['error missing failure code', finish('error', { message: 'private' })],
    ['error missing failure message', finish('error', { code: 'NETWORK' })],
    ['error non-string failure code', finish('error', { code: 503, message: 'private' })],
    ['error non-string failure message', finish('error', { code: 'NETWORK', message: {} })],
  ]) test(`malformed terminal ${label} must become a protocol failure`, async () => {
    const h = harness({ respond: () => source([{ type: 'block-delta', delta: 'PRIVATE' }, terminal]) });
    assertFailure(await collect(h.run()), 'REVIEW_PROTOCOL');
    assert.equal(h.calls.length, 1);
  });
});

describe('bounded cancellation and cleanup', { concurrency: true }, () => {
  test('already-aborted request and plugin lifetime do not contact any provider', async () => {
    for (const where of ['request', 'lifetime']) {
      const controller = new AbortController();
      controller.abort(new Error('private cancel reason'));
      const h = harness({ signal: where === 'lifetime' ? controller.signal : undefined });
      assertFailure(await collect(h.run(options(where === 'request' ? { signal: controller.signal } : {}))), 'ABORTED', 'aborted');
      assert.equal(h.calls.length, 0);
    }
  });
  test('midstream parent cancellation discards fragments, closes iterator and never falls back', async () => {
    const controller = new AbortController();
    const pending = deferred();
    const started = deferred();
    let returned = 0;
    let nextCount = 0;
    const h = harness({ respond: request => ({
      [Symbol.asyncIterator]() { return this; },
      next() {
        if (!nextCount++) return Promise.resolve({ done: false, value: { type: 'block-delta', delta: 'PRIVATE' } });
        request.signal.addEventListener('abort', () => pending.resolve({ done: true }), { once: true });
        started.resolve();
        return pending.promise;
      },
      return() { returned++; return Promise.resolve({ done: true }); },
    }) });
    const output = collect(h.run(options({ signal: controller.signal })));
    await started.promise;
    controller.abort();
    assertFailure(await output, 'ABORTED', 'aborted');
    assert.equal(returned, 1);
    assert.equal(h.calls.length, 1);
  });
  test('non-cooperative cancellation remains bounded and never starts fallback', { timeout: 2000 }, async () => {
    const controller = new AbortController();
    const started = deferred();
    let returned = 0;
    const h = harness({ cleanupMs: 20, respond: () => ({
      [Symbol.asyncIterator]() { return this; }, next() { started.resolve(); return never(); },
      return() { returned++; return never(); },
    }) });
    const output = collect(h.run(options({ signal: controller.signal })));
    await started.promise;
    const before = performance.now();
    controller.abort();
    assertFailure(await output, 'ABORTED', 'aborted');
    assert.ok(performance.now() - before < 1000, 'cancel must not wait for an uncooperative provider');
    assert.equal(returned, 1);
    assert.equal(h.calls.length, 1);
  });
  test('timeout aborts and drains the old transport before allowing fallback', { timeout: 3500 }, async () => {
    const order = [];
    const pending = deferred();
    const h = harness({ cleanupMs: 100, respond: (request, index) => {
      if (index) { order.push('fallback'); return source(text('safe')); }
      return {
        [Symbol.asyncIterator]() { return this; },
        next() { request.signal.addEventListener('abort', () => { order.push('aborted'); pending.resolve({ done: true }); }, { once: true }); return pending.promise; },
        return() { order.push('returned'); return Promise.resolve({ done: true }); },
      };
    } });
    assert.deepEqual(await collect(h.run()), text('safe'));
    assert.equal(h.calls.length, 2);
    assert.equal(h.attempts[0].code, 'TIMEOUT');
    assert.ok(order.indexOf('aborted') < order.indexOf('fallback'));
    assert.ok(order.indexOf('returned') < order.indexOf('fallback'));
  });
  test('timeout is a hard race but a transport that cannot drain blocks fallback', { timeout: 3500 }, async () => {
    let returned = 0;
    const h = harness({ cleanupMs: 20, respond: () => ({
      [Symbol.asyncIterator]() { return this; }, next() { return never(); },
      return() { returned++; return never(); },
    }) });
    const before = performance.now();
    assertFailure(await collect(h.run()), 'REVIEW_DRAIN_FAILED');
    assert.ok(performance.now() - before < 3000);
    assert.equal(returned, 1);
    assert.equal(h.calls.length, 1);
  });
  test('timeout after a completed text block cannot model-shop or expose buffered text', { timeout: 3500 }, async () => {
    const h = harness({ respond: request => {
      const chunks = text('PRIVATE-COMPLETE-ANSWER').slice(0, -1);
      let index = 0;
      const pending = deferred();
      return {
        [Symbol.asyncIterator]() { return this; },
        next() {
          if (index < chunks.length) return Promise.resolve({ done: false, value: chunks[index++] });
          request.signal.addEventListener('abort', () => pending.resolve({ done: true }), { once: true });
          return pending.promise;
        },
        return() { return Promise.resolve({ done: true }); },
      };
    } });
    assertFailure(await collect(h.run()), 'TIMEOUT');
    assert.equal(h.calls.length, 1);
  });
  test('a rejecting cleanup cannot be treated as confirmed drain before fallback', async () => {
    let returned = 0;
    const h = harness({ respond: () => ({
      [Symbol.asyncIterator]() { return this; },
      next() { return Promise.reject(Object.assign(new Error('transport unavailable'), { code: 'NETWORK' })); },
      return() { returned++; return Promise.reject(new Error('transport cleanup failed')); },
    }) });
    assertFailure(await collect(h.run()), 'REVIEW_DRAIN_FAILED');
    assert.equal(returned, 1);
    assert.equal(h.calls.length, 1);
  });
  test('cleanup returning done:false cannot confirm transport shutdown before fallback', async () => {
    const h = harness({ respond: () => ({
      [Symbol.asyncIterator]() { return this; },
      next() { return Promise.reject(Object.assign(new Error('transport unavailable'), { code: 'NETWORK' })); },
      return() { return Promise.resolve({ done: false, value: { type: 'block-delta', delta: 'PRIVATE-CLEANUP' } }); },
    }) });
    assertFailure(await collect(h.run()), 'REVIEW_DRAIN_FAILED');
    assert.equal(h.calls.length, 1);
  });
  test('failed attempt with a hanging return cannot start fallback', { timeout: 2000 }, async () => {
    let returned = 0;
    const h = harness({ cleanupMs: 20, respond: () => ({
      [Symbol.asyncIterator]() { return this; },
      next() { return Promise.reject(Object.assign(new Error('secret'), { code: 'NETWORK' })); },
      return() { returned++; return never(); },
    }) });
    assertFailure(await collect(h.run()), 'REVIEW_DRAIN_FAILED');
    assert.equal(returned, 1);
    assert.equal(h.calls.length, 1);
  });
  test('handler.drain waits for active transport cleanup during plugin lifetime cancellation', async () => {
    const lifetime = new AbortController();
    const started = deferred();
    const closing = deferred();
    const closeGate = deferred();
    const h = harness({ signal: lifetime.signal, cleanupMs: 500, respond: request => ({
      [Symbol.asyncIterator]() { return this; },
      next() {
        started.resolve();
        return new Promise(resolve => request.signal.addEventListener('abort', () => resolve({ done: true }), { once: true }));
      },
      return() { closing.resolve(); return closeGate.promise; },
    }) });
    const output = collect(h.run());
    await started.promise;
    let drained = false;
    const draining = h.handler.drain().then(() => { drained = true; });
    lifetime.abort();
    await closing.promise;
    assert.equal(drained, false, 'lifecycle drain must wait for iterator.return completion');
    closeGate.resolve({ done: true });
    await draining;
    assertFailure(await output, 'ABORTED', 'aborted');
    assert.equal(h.calls.length, 1);
    await h.handler.drain();
  });
  test('late rejection of an aborted next operation is consumed rather than unhandled', async () => {
    const controller = new AbortController();
    const pending = deferred();
    const started = deferred();
    const h = harness({ cleanupMs: 10, respond: () => ({
      [Symbol.asyncIterator]() { return this; }, next() { started.resolve(); return pending.promise; },
      return() { return Promise.resolve({ done: true }); },
    }) });
    const output = collect(h.run(options({ signal: controller.signal })));
    await started.promise;
    controller.abort();
    assertFailure(await output, 'ABORTED', 'aborted');
    pending.reject(new Error('late provider rejection'));
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(h.calls.length, 1);
  });
});
