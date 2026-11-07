import { createRequire } from 'node:module';
import { realpathSync } from 'node:fs';
import { join } from 'node:path';

/** Resolve the running DSH installation without user-specific installation paths. */
export function requireHarnessModule(specifier, {
  resourcesPath = process.resourcesPath,
  entryPath = process.argv[1],
  moduleUrl = import.meta.url,
  makeRequire = createRequire,
  realpath = realpathSync,
} = {}) {
  if (specifier !== '@deepseek-ai/schemastery') throw new Error('Unsupported Harness runtime import');
  const anchors = [];
  if (resourcesPath) anchors.push(join(resourcesPath, 'app.asar', 'dsh', 'package.json'));
  if (entryPath) {
    try { anchors.push(realpath(entryPath)); } catch { /* Not a filesystem entry, try package resolution. */ }
  }
  anchors.push(moduleUrl);
  for (const anchor of new Set(anchors)) {
    const requireFrom = makeRequire(anchor);
    let resolved;
    try { resolved = requireFrom.resolve(specifier); }
    catch (error) {
      if (error.code === 'MODULE_NOT_FOUND') continue;
      throw error;
    }
    // Module execution errors are not resolution failures and must remain visible.
    return requireFrom(resolved);
  }
  throw Object.assign(new Error('Cannot resolve DSH runtime. Install this bundle into an existing DSH profile; do not run host.js directly.'), {
    code: 'DSH_RUNTIME_NOT_FOUND',
  });
}
