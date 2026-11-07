# Upstream and provenance

This is an independent community extension for DeepSeek Harness, not an official fork or replacement of its authorization reviewer.

## Source references

- Official project: https://github.com/deepseek-ai/deepseek-harness
- Official package: [`@deepseek-ai/dsh-experimental-auto-review`](https://github.com/deepseek-ai/deepseek-harness/tree/master/packages/experimental/auto-review)
- Reference revision for DSH `0.2.2-rc.1`: [`fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159`](https://github.com/deepseek-ai/deepseek-harness/commit/fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159)
- Reviewer request construction: [`classifyRisk`](https://github.com/deepseek-ai/deepseek-harness/blob/fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159/packages/experimental/auto-review/src/index.ts#L669-L692)
- Original Codex temperature bug report: https://github.com/deepseek-ai/deepseek-harness/discussions/12495
- Upstream license: [MIT](https://github.com/deepseek-ai/deepseek-harness/blob/fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159/LICENSE)

## Implementation boundary

This repository adds a `llm/stream` waterfall listener and a Client settings section. Only requests with `purpose: auto-review` are routed. The reviewer request retains the upstream policy, retained history, tool arguments, and session identity. Responses go back to the upstream strict reader. No upstream review policy or reviewer implementation is bundled here.

The Codex compatibility layer omits the unsupported `temperature` option on the `openai-codex` Auto review route, including when following the session model. It does not grant authority or manufacture an allow decision.

The provider selector joins the same DSH registered/configurable-provider directory and redacted settings profiles as Settings → Models. Model choices use the shared Session model catalog. The plugin has its own package name and settings namespace; it does not change the upstream packages or require edits to the DSH application archive.

The public package was prepared from a working local prototype, excluding machine-specific reports, test fixtures, personal installation paths, and user configuration. Distribution-specific changes are the public package identity, portable runtime resolution, and self-contained Codex compatibility. The SVG icon was created for this plugin.
