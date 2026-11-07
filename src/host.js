import { requireHarnessModule } from './host-runtime.js';
import { withCodexCompatibility } from './codex-compat.js';
import { createReviewHandler, DEFAULT_ROUTING, normalizeRouting } from './router.js';

const Schema = requireHarnessModule('@deepseek-ai/schemastery');

export const name = 'pnpwin-auto-review-fallback';
export const inject = ['llm', 'settings'];
const routeSchema = Schema.object({
  provider: Schema.string().min(1).max(200).required(),
  model: Schema.string().min(1).max(300).required(),
  reasoningEffort: Schema.string().max(64).default(''),
});
const routingSchema = Schema.object({
  mode: Schema.union(['session', 'chain']).default('session'),
  routes: Schema.array(routeSchema).max(8).default([]),
  timeoutMs: Schema.number().step(1).min(1000).max(120000).default(20000),
});
export const Config = Schema.object({
  routing: Schema.transform(routingSchema, value => normalizeRouting(value))
    .default(DEFAULT_ROUTING).volatile(),
});

export function apply(ctx, config) {
  const lifetime = new AbortController();
  ctx.effect(() => ctx.settings.configure({ auto: false }));
  const handler = createReviewHandler({
    stream: options => ctx.llm.stream(options),
    readRouting: () => config.routing.get(),
    signal: lifetime.signal,
    onAttempt: entry => {
      // Model identities/status only. Do not log review input, output or reasons.
      ctx.logger.info('Auto review route %s/%s [%d]: %s%s', entry.provider, entry.model,
        entry.index + 1, entry.outcome, entry.code ? ` (${entry.code})` : '');
    },
  });
  ctx.on('llm/stream', withCodexCompatibility(handler, options => ctx.llm.stream(options)), { prepend: true });
  ctx.effect(() => async () => {
    lifetime.abort(new Error('Auto review router unloaded'));
    await handler.drain();
  });
}
