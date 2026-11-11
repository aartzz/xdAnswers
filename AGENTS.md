# xdAnswers

Manifest V3 browser extension that solves online-test questions with AI. Targets Chrome/Chromium and Firefox. TypeScript bundled by esbuild; no framework and no test suite. User-facing README is Ukrainian.

## Commands

```bash
npm install              # canonical install; package-lock.json is tracked
npm run typecheck        # tsc --noEmit; the only static verification
npm run dev              # Chrome dist tree only (scripts/build.js chrome)
npm run build:firefox    # dist tree + build/xdAnswers-firefox-*.xpi
npm run build:chrome     # dist tree + build/xdAnswers-chrome-*.crx
npm run sign:firefox     # builds, then signs via Mozilla API
node scripts/build.js firefox && npx web-ext run --config .web-ext-config.js
node scripts/build.js chrome  && npx web-ext run --config .web-ext-config.js -t chromium
```

- `web-ext` auto-discovers `web-ext-config.js`, not this repo's `.web-ext-config.js`; always pass `--config .web-ext-config.js`.
- `web-ext run` loads `./dist`; build the matching target first. `npm run dev` is Chrome-only, so do not load its output in Firefox.
- `build:chrome` needs Chrome/Chromium installed or `CHROME_BIN` set; it shells out to `--pack-extension`.
- `sign:firefox` needs `WEB_EXT_API_KEY` / `WEB_EXT_API_SECRET` in the shell or `.env` (see `.env.example`).
- Every `scripts/build.js` run deletes and recreates `dist/` and exits; there is no watcher, so rerun after source edits. The last target built wins.
- Load `dist/` as the unpacked extension; the repository root is not an extension root.
- No lint, formatter, or test command exists, and CI only builds. Run `npm run typecheck` plus the relevant build locally.

## Build and manifest rules

- `manifest.common.json` is the source of truth for permissions, match patterns, content-script ordering, and web-accessible resources. `scripts/build.js` generates `dist/manifest.json` and injects browser-specific keys (Chrome `service_worker` vs Firefox background scripts, Gecko ID, data-collection permissions). Do not create or edit a root `manifest.json`; it is generated and gitignored.
- Content-script blocks with more than three scripts are split by the builder: the longest common script prefix across all such blocks becomes `dist/core.js`, and the remainder becomes one provider bundle. A new or changed provider block must repeat that core prefix exactly, in the same order; otherwise the prefix shrinks and the build emits different bundles or fails on duplicate names.
- `content_scripts[].js` in `manifest.common.json` lists source paths under `src/`; the builder rewrites them to generated `dist` bundle names. Do not point these entries at `dist/`.
- Provider bundle names come from the provider directory: `src/providers/<name>/...` -> `dist/<name>.js`; nested routes join with dashes, e.g. `src/providers/naurok/round/main.ts` -> `dist/naurok-round.js`. Blocks with three or fewer scripts bypass the prefix split and are bundled together into one file named after their first script.
- Shared core modules are side-effect IIFEs executed in manifest order. When adding one, insert it into the core prefix of every provider block at the same position.
- `copyStaticAssets()` only copies `images/`, `src/rules/`, the two popup CSS files, `popup.html`, and the Material Symbols font. Add any new runtime asset there; web-accessible `.ts`/`.js` entries are bundled and rewritten automatically.
- Generated output (`dist/`, `build/`) and `.env`, `*.pem` are ignored. Never commit signing keys or edit generated bundles.

## Execution model

- `src/core` is the shared content-script platform (settings/storage, HTTP bridge, answer cache, stats, disabler). `src/dom` holds shared DOM matching, selection, silent-mode and one-click logic. `src/ai` contains the answer pipeline, streaming/SSE parsing, web search, calculator, and batch mode. `src/providers/<site>` is per-site DOM extraction and automation. `src/popup` is the settings UI; `src/ui` is the injected helper UI; `src/background.ts` is the extension worker.
- Settings persist in `chrome.storage.local` under `xdAnswers_settings` as a JSON string. Defaults live in `src/core/settings-defaults.ts`; both `src/core/settings.ts` and `src/popup/core/settings.ts` load/migrate the stored shape, and popup `autoSave()` maps UI fields. Flat defaults merge automatically, but nested objects need matching merge logic in both loaders.
- Runtime state is shared through `window.xdAnswers` and `window.xdAnswers._internal`; add new public members to `src/types/global.d.ts`. Provider submodules publish to `_internal.providerModules.<providerId>` and the provider `main.ts` consumes them.
- Provider `main.ts` bundles must not import `src/core`, `src/ai`, or `src/ui`: esbuild would inline a second copy and fork state. Call `window.xdAnswers` instead. Exception: `src/providers/*/disabler.ts` is bundled with `src/core/disabler/page.ts` and may import `src/core/disabler/*`.
- AI/network calls go through the background worker using `makeRequest` / `streamRequest` messaging. Chrome uses `fetch`; Firefox uses `XMLHttpRequest` because MV3 service-worker `fetch` is CORS-limited there. OpenCode Zen requests also depend on the DNR header rule in `src/rules/opencode-identity.json`.
- `src/core/disabler/disabler-inject.ts` is the `document_start` content script; when enabled it injects `dist/disabler.js` into the page world.
- `// @ts-nocheck` disables typechecking for all `src/popup/**/*.ts` and the core page-world disabler modules; test those changes at runtime.

## Adding or changing a site provider

- Add `src/providers/<name>/main.ts` as the content-script entry, with DOM helpers usually split under `dom/` and applying logic in `autoanswer.ts`. Imported files are bundled, but the new match block must be added to `manifest.common.json` with the standard core prefix.
- A provider page-world patch at `src/providers/<name>/disabler.ts` is collected automatically into `dist/disabler.js`; it must self-gate on `location.hostname` because it ships to all supported sites.
- A provider only ships if `manifest.common.json` has a content-script block; not every directory under `src/providers/` is wired up (`canvaslms/` and `moodle/` currently are not).
- When adding or removing a supported host, update three places: the content-script `matches` in `manifest.common.json`, the supported-sites table in `README.md`, and `SUPPORTED_HOSTS` in `src/popup/main.ts`.
- UI strings live in `src/ui/i18n/{en,uk,ru}.ts`; keep all three tables in sync. Ukrainian is the default language.
- `popup.html` is transformed at build time: the `src/core/constants.js`, `src/core/settings-defaults.js`, and `src/ui/i18n.js` script tags are removed because `src/popup/main.ts` imports them. The build fails if a tag is missing, so update both sides together.

## Adding an API provider

- Update `DEFAULT_BASE_URLS` and `API_FORMAT_MAP` in `src/core/constants.ts`, and add the provider to `API_PROVIDERS` in `src/popup/providers/data.ts`. These tables are maintained separately.

## Versioning and release

- Bump versions with `npm version <x.y.z>`; its hook runs `scripts/sync-version.js` and stages the matching `manifest.common.json` update. `package.json` and `manifest.common.json` versions must stay equal; do not edit the manifest version manually.
- The displayed build version comes from the current git tag, else `git+<short-hash>` plus `-dirty` for modified tracked files. `XD_VERSION` overrides it.
- Pushing a `v*` tag runs the release workflow (Node 20, `npm install`, Chrome CRX build, Firefox signing, GitHub release). Commit subjects become release notes, so follow the existing Conventional Commits style (`feat(provider): ...`, `fix(area): ...`, `chore(release): ...`).
- Chrome keeps a stable extension ID only if the same signing key is reused: `CHROME_EXTENSION_KEY` (PEM text or path) in CI, or the local `build/chrome-extension.pem`.
