/** Auto review-only routing. No policy decisions are made or rewritten here. */
export const DEFAULT_ROUTING = Object.freeze({ mode: 'session', routes: [], timeoutMs: 20000 });
const MAX_BUFFER_BYTES = 2 * 1024 * 1024;
const MAX_CHUNKS = 20000;
const AVAILABILITY_CODES = new Set([
  'RATE_LIMIT', 'QUOTA', 'SERVER', 'TIMEOUT', 'TRANSPORT', 'NETWORK',
  'NO_ADAPTER', 'UNKNOWN_MODEL', 'MISSING_CREDENTIAL', 'INVALID_CREDENTIAL', 'AUTH',
  'ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN',
  'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_SOCKET', 'UND_ERR_HEADERS_TIMEOUT',
]);
const NON_AVAILABILITY_CODES = new Set([
  'ABORTED', 'SAFETY', 'CONTENT_FILTER', 'POLICY_VIOLATION',
  'INVALID_REQUEST', 'UNSUPPORTED_OPTION', 'UNSUPPORTED_REASONING_EFFORT',
  'REVIEW_PROTOCOL', 'REVIEW_BUFFER_LIMIT', 'REVIEW_DRAIN_FAILED',
]);

export function normalizeRouting(value) {
  if (!value || !['session', 'chain'].includes(value.mode)) throw new Error('Invalid Auto review routing mode');
  if (!Number.isInteger(value.timeoutMs) || value.timeoutMs < 1000 || value.timeoutMs > 120000) {
    throw new Error('Auto review timeout must be an integer from 1000 to 120000 ms');
  }
  if (!Array.isArray(value.routes) || value.routes.length > 8 || (value.mode === 'chain' && !value.routes.length)) {
    throw new Error('Choose one primary model and at most seven fallbacks');
  }
  const seen = new Set();
  const routes = value.routes.map(route => {
    if (!route || typeof route.provider !== 'string' || typeof route.model !== 'string'
        || !route.provider.trim() || !route.model.trim()
        || route.provider.length > 200 || route.model.length > 300
        || (route.reasoningEffort !== undefined && typeof route.reasoningEffort !== 'string')) {
      throw new Error('Each review route requires a provider and model ID');
    }
    const provider = route.provider.trim();
    const model = route.model.trim();
    const key = JSON.stringify([provider, model]);
    if (seen.has(key)) throw new Error('Duplicate provider/model pair in Auto review chain');
    seen.add(key);
    const reasoningEffort = (route.reasoningEffort ?? '').trim();
    if (reasoningEffort.length > 64) throw new Error('Reasoning effort ID is too long');
    return Object.freeze({ provider, model, reasoningEffort });
  });
  return Object.freeze({ mode: value.mode, timeoutMs: value.timeoutMs, routes: Object.freeze(routes) });
}

export function isAvailabilityFailure(failure) {
  const code = typeof failure?.code === 'string' ? failure.code.toUpperCase() : '';
  if (NON_AVAILABILITY_CODES.has(code)) return false;
  return AVAILABILITY_CODES.has(code) || [401, 429, 500, 502, 503, 504].includes(failure?.status);
}

function errorWithCode(message, code) { return Object.assign(new Error(message), { code }); }
function failureOf(error) {
  // Do not copy provider error text, stack, request payloads or credentials into logs.
  return {
    code: typeof error?.code === 'string' ? error.code : 'REVIEW_INTERNAL_ERROR',
    message: 'Auto review route failed',
    ...(typeof error?.status === 'number' ? { status: error.status } : {}),
  };
}
function finishFailure(code, message, aborted = false) {
  return { type: 'finish', reason: { kind: aborted ? 'aborted' : 'error', failure: { code, message } } };
}

/** Race each iterator operation against cancellation, without an unhandled loser. */
async function abortable(operation, signal) {
  signal.throwIfAborted();
  let onAbort;
  const cancelled = new Promise((_, reject) => {
    onAbort = () => reject(signal.reason ?? errorWithCode('Review cancelled', 'ABORTED'));
    signal.addEventListener('abort', onAbort, { once: true });
  });
  try { return await Promise.race([operation, cancelled]); }
  finally { signal.removeEventListener('abort', onAbort); }
}

/** Do not start a fallback if the preceding transport cannot be drained. */
async function drain(iterator, pending, cleanupMs) {
  let timer;
  try {
    const closing = typeof iterator.return === 'function'
      ? Promise.resolve().then(() => iterator.return()).then(result => result?.done === true, () => false)
      : Promise.resolve(true);
    // A rejected next() is a normal provider failure; a rejected return() is
    // not proof that transport cleanup succeeded. Never overlap a fallback.
    const settled = Promise.all([Promise.resolve(pending).then(() => {}, () => {}), closing])
      .then(([, closed]) => closed);
    return await Promise.race([settled, new Promise(resolve => { timer = setTimeout(() => resolve(false), cleanupMs); })]);
  } finally { clearTimeout(timer); }
}

async function attempt(stream, options, parentSignal, timeoutMs, cleanupMs) {
  const controller = new AbortController();
  const signal = AbortSignal.any([parentSignal, controller.signal]);
  const timer = setTimeout(() => controller.abort(errorWithCode('Auto review attempt timed out', 'TIMEOUT')), timeoutMs);
  let iterator;
  let pending;
  let done = false;
  let bytes = 0;
  let finish;
  let result;
  const chunks = [];
  let completedText = false;
  try {
    signal.throwIfAborted();
    iterator = stream(Object.freeze({ ...options, signal }))[Symbol.asyncIterator]();
    while (true) {
      pending = Promise.resolve().then(() => iterator.next());
      const item = await abortable(pending, signal);
      if (item.done) { done = true; break; }
      const chunk = item.value;
      if (finish) throw errorWithCode('Data after terminal finish', 'REVIEW_PROTOCOL');
      if (!chunk || typeof chunk.type !== 'string') throw errorWithCode('Invalid review stream chunk', 'REVIEW_PROTOCOL');
      bytes += JSON.stringify(chunk).length * 2;
      if (bytes > MAX_BUFFER_BYTES || chunks.length >= MAX_CHUNKS) {
        throw errorWithCode('Review output buffer limit exceeded', 'REVIEW_BUFFER_LIMIT');
      }
      if (chunk.type === 'finish') {
        const reason = chunk.reason;
        if (!reason || !['stop', 'tool-calls', 'max-tokens', 'error', 'aborted'].includes(reason.kind)
            || (['error', 'aborted'].includes(reason.kind)
              && (!reason.failure || typeof reason.failure.code !== 'string' || typeof reason.failure.message !== 'string'))) {
          throw errorWithCode('Invalid terminal review outcome', 'REVIEW_PROTOCOL');
        }
        finish = chunk;
      }
      chunks.push(chunk);
      if (chunk.type === 'block-end' && chunk.block?.type === 'text') completedText = true;
    }
    signal.throwIfAborted();
    if (!finish) throw errorWithCode('Review stream has no terminal finish', 'REVIEW_PROTOCOL');
    result = { chunks, finish, completedText };
  } catch (error) {
    const failure = controller.signal.aborted && !parentSignal.aborted
      ? { code: 'TIMEOUT', message: 'Auto review attempt timed out' }
      : failureOf(error);
    result = { chunks: [], finish: { type: 'finish', reason: { kind: parentSignal.aborted ? 'aborted' : 'error', failure } }, completedText };
  } finally {
    clearTimeout(timer);
    if (!done && iterator) {
      controller.abort(errorWithCode('Review attempt finished', 'ABORTED'));
      if (!await drain(iterator, pending, cleanupMs)) {
        result = { chunks: [], finish: finishFailure('REVIEW_DRAIN_FAILED', 'Previous review transport did not stop; no fallback started'), completedText: true };
      }
    }
  }
  return result;
}

/** Build one waterfall listener. Configuration is snapshotted once per review. */
export function createReviewHandler({ stream, readRouting, signal: lifetime, onAttempt = () => {}, cleanupMs = 1000 }) {
  // A private symbol survives object spreads in other middleware. No JSON field or
  // model-visible purpose marker is introduced. Each plugin instance owns its key.
  const routed = Symbol('pnpwin-auto-review-route');
  const token = Object.freeze({});
  const active = new Set();
  const handle = function handle(options, next) {
    if (options.purpose !== 'auto-review' || options[routed] === token) return next();
    const config = normalizeRouting(readRouting());
    const routes = config.mode === 'session'
      ? [{ provider: options.provider, model: options.model }]
      : config.routes;
    return (async function* () {
      const signals = [options.signal, lifetime].filter(Boolean);
      const parentSignal = signals.length ? AbortSignal.any(signals) : new AbortController().signal;
      const failures = [];
      for (let index = 0; index < routes.length; index++) {
        if (parentSignal.aborted) {
          yield finishFailure('ABORTED', 'Auto review cancelled; no fallback started', true);
          return;
        }
        const route = routes[index];
        // Cross-model routes never inherit another model's sampling/reasoning.
        // Session mode keeps its own controls; the Codex wrapper removes temperature.
        const { temperature: _temperature, reasoningEffort: _effort, ...rest } = options;
        const request = config.mode === 'session'
          ? Object.freeze({ ...options, [routed]: token })
          : Object.freeze({ ...rest, provider: route.provider, model: route.model,
            ...(route.reasoningEffort ? { reasoningEffort: route.reasoningEffort } : {}), [routed]: token });
        const running = attempt(stream, request, parentSignal, config.timeoutMs, cleanupMs);
        active.add(running);
        let result;
        try { result = await running; }
        finally { active.delete(running); }
        if (parentSignal.aborted) {
          yield finishFailure('ABORTED', 'Auto review cancelled; no fallback started', true);
          return;
        }
        const reason = result.finish.reason;
        onAttempt({ sessionId: options.sessionId, provider: route.provider, model: route.model,
          index, outcome: reason.kind, ...(reason.failure ? { code: reason.failure.code } : {}) });
        // A stop (including deny or malformed JSON), max-tokens, policy failure,
        // abort, or a completed text answer is NEVER a reason to model-shop.
        if (config.mode === 'session' || reason.kind !== 'error' || result.completedText || !isAvailabilityFailure(reason.failure)) {
          if (result.chunks.length) yield* result.chunks;
          else yield result.finish;
          return;
        }
        failures.push(`${route.provider}/${route.model}: ${reason.failure.code}`);
      }
      yield finishFailure('AUTO_REVIEW_ROUTES_EXHAUSTED', `All configured Auto review routes are unavailable (${failures.join('; ')})`);
    })();
  };
  handle.drain = () => Promise.allSettled([...active]);
  return handle;
}
