/** Codex rejects temperature even in the upstream reviewer's session-model mode. */
export function withCodexCompatibility(handler, stream) {
  return function compatible(options, next) {
    if (options.purpose === 'auto-review' && options.provider === 'openai-codex'
        && Object.hasOwn(options, 'temperature')) {
      const { temperature: _unsupported, ...request } = options;
      // Re-enter once: the copy has no own temperature property. Retain every
      // other input and propagate every decision/failure without interpretation.
      return stream(Object.freeze(request));
    }
    return handler(options, next);
  };
}
