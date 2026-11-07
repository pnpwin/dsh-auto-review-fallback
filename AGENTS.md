# Repository layout and maintenance rules

These are the project owner's standing requirements for this repository.

- Keep all plugin runtime JavaScript and bundled runtime assets under `src/`. Do not add executable source files to the repository root.
- Root files are limited to documentation and required package/DSH metadata: the package manifest, bundle patch, ignore rules, license, upstream attribution, readmes, and this instruction document.
- Keep the existing `test/`, `locale/`, and `.github/` directories in place. Tests remain in `test/`; localization resources remain in `locale/`. Do not reorganize these directories merely to move runtime source files.
- A source relocation must update package exports, the icon path, the packed file allowlist, test imports, CI commands, and documentation together.
- Preserve the package name, Loader row ID, Client module ID, and settings namespace across layout-only changes. Do not migrate or reset user routing settings.
- Run `npm test`, syntax checks for `src/*.js`, and `npm pack --dry-run --json --ignore-scripts` before publishing changes. Check that the archive contains the declared Host/Client entry points, icon, bundle patch, and locales.
- Keep generated archives, local verification reports, credentials, user profiles, and machine-specific paths out of version control.
- A browser refresh does not reload cached Host modules. Document a DSH restart when an installed package's Host entry or exports change; do not claim an end-to-end runtime check from unit tests alone.
