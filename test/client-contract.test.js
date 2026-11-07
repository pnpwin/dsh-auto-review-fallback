import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../client.js', import.meta.url), 'utf8');
function remoteDependencies(text) {
  const declaration = /inject:\s*\[([^\]]*)\]/.exec(text)?.[1] ?? '';
  const declared = new Set([...declaration.matchAll(/['"]([^'"]+)['"]/g)].map(match => match[1]));
  const used = new Set([...text.matchAll(/ctx\.remote\.([a-zA-Z]\w*)/g)].map(match => `remote.${match[1]}`));
  return [...used].filter(name => !declared.has(name));
}

test('client explicitly injects every remote namespace it accesses', () => {
  assert.deepEqual(remoteDependencies(source), []);
});

test('regression: injecting only remote does not cover remote.settings', () => {
  const previous = source.replace(", 'remote.settings'", '');
  assert.deepEqual(remoteDependencies(previous), ['remote.settings']);
});

test('settings uses the raw Loader row ID, not the Inspect entry path', () => {
  assert.ok(source.includes("const SETTINGS_NS = 'pnpwin-auto-review-fallback'"));
  assert.ok(!source.includes("const SETTINGS_NS = 'include:pnpwin-auto-review-fallback'"));
});
