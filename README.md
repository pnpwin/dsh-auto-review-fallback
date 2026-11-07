# DSH Auto Review Fallback

Independent reviewer models and **ordered, fail-closed fallbacks** for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).

English · [Русский](./README.ru.md)

> Community plugin by [pnpwin](https://github.com/pnpwin), not an official DeepSeek product. Auto review is experimental and can authorize unsafe actions with full host access. A faster/smaller reviewer is not necessarily a safe reviewer.

## What it does

- Pick a reviewer **provider + exact model ID**, independently of the conversation model.
- Configure one primary reviewer and up to **seven ordered fallbacks**.
- Set a per-attempt timeout (1–120 seconds; default 20 seconds).
- Optionally set a supported reasoning-effort ID per route, or leave it empty for the adapter default.
- Choose connected providers by their names in **Settings → Models**. Models use DSH's shared model catalog, with saved model IDs/manual input as a fallback.
- Use English or Russian settings UI, with DSH theme tokens.
- Handle the Codex `Unsupported parameter: temperature` incompatibility without requiring a separate compatibility plugin.

This is a fallback **chain**, not random load balancing, voting, or a search for a model willing to approve a command. Each new review starts with the primary model.

## Upstream source and original issue

This plugin extends the official [`@deepseek-ai/dsh-experimental-auto-review`](https://github.com/deepseek-ai/deepseek-harness/tree/master/packages/experimental/auto-review) through DSH's public `llm/stream` extension point. It does **not** bundle or replace the upstream authorization policy, response parser, or tool-execution gate.

The original Codex incompatibility was reported in [DeepSeek Harness Discussion #12495](https://github.com/deepseek-ai/deepseek-harness/discussions/12495). See [Upstream and provenance](./UPSTREAM.md) for the exact reference revision and implementation scope.

## Requirements

- **DSH 0.2.2-rc.1** with its built-in experimental **Auto review** enabled.
- A Web/Desktop profile with Models settings and configured providers.
- Node.js **24.9.0 or newer** for standalone tests.

The underlying local implementation was exercised in macOS DSH Desktop. This public distribution additionally tests package identity, portable runtime resolution, and integrated Codex compatibility; it has not been installed alongside the working local plugin. Other DSH versions/platforms and CLI-host module resolution are unverified. The DSH engine constraint is intentionally exact.

## Installation

This is a GitHub source bundle, **not an npm release**. There are no dependencies, install scripts, or build step.

1. Clone the repository:

   ```sh
   git clone https://github.com/pnpwin/dsh-auto-review-fallback.git
   cd dsh-auto-review-fallback
   ```

2. Install the absolute package directory into your DSH profile using Plugin Manager, or the existing CLI:

   ```sh
   dsh plugin --profile desktop add "$PWD"
   ```

   Replace `desktop` with the intended profile name. An agent in that profile can use its `plugin_manager` tool with `action: install_bundle` and this directory's absolute path.

3. Refresh the **existing DSH page** and open **Settings → Auto review**.
4. Enable Auto review for the conversation where you want to use it.

The profile may link this directory. Do not delete or move it while installed. After a `git pull`, restart DSH and refresh the page so both cached Host code and the Client artifact are replaced.

**Migration from the original local prototype:** disable/remove `@local/dsh-auto-review-router` before enabling this package. Do not run two independent reviewer routers together. The published package uses its own settings namespace (`pnpwin-auto-review-fallback`) and does not automatically copy existing chains. Publishing this repository does not replace any locally installed plugin.

## Configuration

The default is **Follow session**: use the conversation's current model. No new provider is chosen automatically. The Codex temperature compatibility fix also applies in this mode.

To select a lighter reviewer:

1. Choose **Custom model chain**.
2. Select the primary provider and model, then add/reorder any fallback routes.
3. Leave **Reasoning effort** empty unless you know the exact ID is supported by that model. Unsupported explicit effort is a configuration error: it stops the review, rather than silently clamping the effort or trying another model.
4. Set the attempt timeout and click **Save**.

Saving uses DSH's own settings API with revision/conflict checks. Changes apply to new reviews, including in existing conversations. An in-flight review keeps its original configuration snapshot. The conversation model and session permission mode are not changed.

If a provider was added/renamed in Models, reopen the page or click **Reload catalog**. An unavailable catalog does not remove saved/manual model IDs.

### Privacy

Every attempted reviewer receives the upstream review input: its authorization policy, retained instructions/history, and pending tool arguments. A fallback to another provider may therefore send the same data to another organization. Select only providers and endpoints you trust. The plugin does not log the review prompt, generated answer, credentials, or denial reason; route IDs and technical status codes may appear in DSH logs.

## Fallback rules

| Outcome | Behavior |
| --- | --- |
| Recognized rate limit, quota, timeout, network/transport failure, selected server errors, or unavailable route/model/credentials | Try the next configured route, after stopping the previous transport. |
| Normal completion, including `deny` | Stop the chain and let the upstream reviewer validate the response. |
| Malformed JSON, unsupported explicit options/effort, max-tokens, policy refusal, or unknown error | No fallback. Preserve the upstream failure/approval behavior. |
| Technical error after a completed text answer | No fallback; do not ask another model to overturn the answer. |
| Parent cancellation or plugin unload | Abort and do not start another route. |
| Previous transport cannot be confirmed stopped | Fail closed; do not overlap a fallback. |
| All routes unavailable | Return `AUTO_REVIEW_ROUTES_EXHAUSTED`; the tool body is not executed. |

Failed attempts are buffered so partial text does not leak into a fallback answer. The buffer is limited to 2 MiB/20,000 chunks. Unknown provider error messages are not guessed to be availability failures. Total latency can approach the sum of attempt deadlines plus bounded cleanup time. This is not a security guarantee, and it does not make unreliable reviewer decisions safe.

## Repository layout

All plugin runtime JavaScript and the icon live in `src/`. The root contains only documentation and package/DSH metadata. Existing `test/`, `locale/`, and `.github/` directories keep their roles. This is an uncompiled JavaScript bundle: DSH loads the `src/` entry points declared in the package exports; no additional build step is required.

The owner's standing layout rules are recorded in [AGENTS.md](./AGENTS.md) and enforced by a package-layout regression test. Runtime behavior and the settings namespace are unchanged by the v0.1.1 relocation. Restart DSH after updating an installed package to the new entry paths.

## Verification

```sh
npm test
node --check src/host.js
node --check src/client.js
```

The dependency-free Node tests cover routing, failures, denials, malformed output, cancellation, bounded draining, concurrent reviews, configuration snapshots, native Models catalog projection, explicit Client remote dependencies, package metadata, runtime-module resolution, and Codex compatibility. They use mocked streams and make **no real model inference calls**.

The local prototype also passed in-process checks against the real DSH LLM waterfall and configured provider catalogs. The reporting user confirmed the original Codex workaround works. Browser clicks, form submission, and this renamed public package are not claimed to have been end-to-end tested. For a harmless manual check, select your reviewer, enable Auto review, and ask the agent to run only `pwd`. Never test denial behavior with real destructive commands.

## Troubleshooting

- **`cannot get property "remote.settings" without inject`:** update and restart/refresh DSH. This package explicitly injects every remote namespace it uses.
- **Only one provider appears:** update and refresh. The current provider selector is a full dropdown, not a `datalist` filtered by the existing input text.
- **`UNSUPPORTED_REASONING_EFFORT`:** clear the optional effort field or select an effort that the exact model supports.
- **Settings conflict:** reload current settings before saving again; the plugin never retries an unconditional overwrite.
- **Runtime module cannot be resolved:** install the directory as a DSH bundle rather than executing the Host entry as a standalone Node script.

## License

[MIT](./LICENSE). The shield/route SVG icon was created for this plugin. DeepSeek Harness and its official Auto review remain separate upstream projects.
