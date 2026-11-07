import { frameReviewRequest } from './review-framing.js';

/** Prepare review controls against the exact adapter registration used to dispatch. */
export function createReviewStream(llm) {
  return async function* reviewStream(options) {
    const { provider, model, reasoningEffort, temperature, maxTokens, stop } = options;
    const prepared = await llm.prepareCall({
      provider, model,
      ...(reasoningEffort === undefined ? {} : { reasoningEffort }),
      ...(temperature === undefined ? {} : { temperature }),
      ...(maxTokens === undefined ? {} : { maxTokens }),
      ...(stop === undefined ? {} : { stop }),
    }, options.signal, (controls, info) => {
      const reasoning = info.reasoning;
      // pi-ai otherwise treats omitted effort as "off", even for always-thinking
      // models (e.g. GLM-5.3). Respect explicit and adapter-configured defaults.
      if (controls.reasoningEffort !== undefined || reasoning === undefined
          || reasoning.defaultEffort !== undefined
          || reasoning.efforts.some(effort => effort.id === 'off')
          || reasoning.efforts.length === 0) return controls;
      return { ...controls, reasoningEffort: reasoning.efforts[0].id };
    });
    yield* prepared.stream(frameReviewRequest(Object.freeze({ ...options, ...prepared.config }), prepared));
  };
}
