# xdAnswers

[🇺🇦 Українська](README.md) | **English**

![GitHub Actions Workflow Status](https://img.shields.io/github/actions/workflow/status/aartzz/xdAnswers/build.yml)
![GitHub Repo stars](https://img.shields.io/github/stars/aartzz/xdAnswers?style=flat)

Free, open-source Chrome extension that solves test questions with AI.

Works out of the box — ships with free providers, no API key needed.
> [!IMPORTANT]  
> **Beta** — bugs happen. [Report them](https://github.com/aartzz/xdAnswers/issues).

![Screenshot](images/README/ui.png)

## Features

- **Free by default** — 4 built-in providers with no API key: Unturf Hermes, Unturf Qwen, Unturf Vision (for images), OpenCode Zen
- **Any OpenAI-compatible API** — OpenAI, Anthropic, Gemini, DeepSeek, Groq, local Ollama, anything
- **Image recognition** — handles images in questions and answer options (via vision-capable providers)
- **Web search** — the model can search the web for current information (via LangSearch / SearXNG, up to 3 iterations)
- **Silent modes** — indicators (dot next to correct answer), page title, clipboard-only stealth, or one-click (click question to answer)
- **Auto-answer** — automatically selects the correct option with configurable cooldown
- **Consensus** — runs the same question through multiple models simultaneously and picks the majority answer
- **Floating helper** — draggable, shows answer + reasoning + elapsed time
- **Multilingual** — interface in Ukrainian, Russian, and English
- **Custom themes** — pick a preset or create your own with the + button
- **Disabler (anti-cheat bypass)** — universal and site-specific (details below)

## Disabler (Anti-cheat Bypass)

The extension includes **two levels of anti-cheat bypass**:

### Universal (toggled in settings)
Works across all sites simultaneously:
- **Blur / Focus bypass** — blocks blur, focus, focusin, focusout events so the site cannot detect tab switching
- **Visibility API spoofing** — always reports `visibilityState = 'visible'` and `hidden = false`
- **Visibilitychange interception** — hides the real page visibility state

### Site-specific (built into providers)
Each platform has its own bypass methods:
- **Naurok** — hiding the helper, minimizing DOM traces
- **Vseosvita** — bypassing copy/paste and tab-switching protection
- **JustClass / Classtime / Miyklas / lCloud** — specific patches for each site

> [!WARNING]
> Disabler does not guarantee 100% invisibility. Use at your own discretion.

## Silent Modes

Modes when the helper is hidden or minimized:

| Mode | Description |
|:---|:---|
| **Indicators** | Green dot next to the correct answer, no text shown |
| **Ghost** | Answer shown only in the browser tab title |
| **Stealth** | Answer copied to clipboard, no visual signs on the page |
| **One-click** | Click on the question container to trigger an answer (no auto-trigger) |

## Consensus

Runs the same question through several different models at once, then:
- Normalizes answers (ignores case, extra spaces, prefixes like "A:")
- Computes majority voting
- Shows agreement level (agreement %) between models
- States: `unanimous` (all agree), `majority` (most agree), `no-consensus` (no agreement)

## Install

### Desktop (Chrome, Brave, Edge, Vivaldi)

1. Go to [Releases](https://github.com/aartzz/xdAnswers/releases), download the latest `xdAnswers-chrome-*.zip`
2. Unzip it
3. Open `chrome://extensions`, enable **Developer mode** (top right)
4. Click **Load unpacked**, select the unzipped folder

### Mobile (Kiwi Browser)

1. Install [Kiwi Browser](https://github.com/kiwibrowser/src.next/releases/tag/14310011181) from GitHub
2. Go to [Releases](https://github.com/aartzz/xdAnswers/releases), download the latest `xdAnswers-chrome-*.zip`
3. Open `kiwi://extensions`, enable **Developer mode**
4. Click **Load unpacked**, select the unzipped folder

### Firefox

The extension is signed by Mozilla — works on any Firefox version without extra configuration.

1. Download `xdAnswers-firefox-*.xpi` from [Releases](https://github.com/aartzz/xdAnswers/releases)
2. Drag the `.xpi` file into a Firefox window → confirm installation

### Build from source

Requires [Node.js](https://nodejs.org/) 18+ (so `npm` is available).

```bash
git clone https://github.com/aartzz/xdAnswers.git
cd xdAnswers
npm install
```

Then pick a target:

```bash
# Firefox — signed .xpi in ./build/xdAnswers-firefox-<version>.xpi
npm run sign:firefox

# Chrome/Brave/Edge/Vivaldi — produces ./build/xdAnswers-chrome-<version>.zip
npm run build:chrome
```

> [!NOTE]
> Signing the Firefox extension requires Mozilla Add-ons API credentials. Create a `.env` file in the project root (see `.env.example`) or pass them via `WEB_EXT_API_KEY` / `WEB_EXT_API_SECRET` environment variables.

Built artifacts land in `./build`. Install them the same way you would install a release build (see sections above).

> [!TIP]
> The `build:firefox` / `build:chrome` scripts are cross-platform (Windows, macOS, Linux) — they generate the correct `manifest.json` for the selected browser, package the extension with `web-ext`, and clean up temporary files for you.

### Development mode (hot reload)

For iterative development, use `web-ext run` — it launches a temporary browser profile with the extension already loaded and auto-reloads it whenever files change:

```bash
# First, generate manifest.json for the target browser
node scripts/build-manifest.js firefox    # or chrome

# Firefox — opens a temporary Firefox with the extension loaded
npx web-ext run

# Chrome/Chromium (requires Chrome installed)
npx web-ext run -t chromium
```

When you're done, remove the generated `manifest.json` with `npm run clean`.

## Usage

1. Click the extension icon → settings open
2. Pick a provider (Unturf Vision is default, works for free)
3. If using a paid API, paste your key
4. Open a test on a supported site — the helper appears automatically

## Supported Sites

| Site | URL | Status | Auto-answer | Disabler | Silent mode |
|------|-----|--------|:-----------:|:--------:|:-----------:|
| NaUrok | [naurok.com.ua](https://naurok.com.ua) | stable | ✅ | ✅ | ✅ |
| Vseosvita | [vseosvita.ua](https://vseosvita.ua) | beta | ✅ | ✅ | ✅ |
| JustClass | [justclass.com.ua](https://justclass.com.ua) | beta | ❌ | ⚠️ | ⚠️ |
| Kahoot! | [kahoot.it](https://kahoot.it) | beta | ❌ | ✅ | ⚠️ |
| Classtime | [classtime.com](https://classtime.com) | beta | ❌ | ⚠️ | ⚠️ |
| MiyKlas | [miyklas.com.ua](https://miyklas.com.ua) | beta | ❌ | ⚠️ | ⚠️ |
| LCloud | [lcloud.in.ua](https://lcloud.in.ua) | beta | ❌ | ⚠️ | ⚠️ |
| Google Forms | [docs.google.com/forms](https://docs.google.com/forms) | beta | ✅ | ⚠️ | ✅ |
| Microsoft Forms | [forms.office.com](https://forms.office.com) | beta | ✅ | ⚠️ | ✅ |

**Marks:** "stable" — full coverage of question formats | "beta" — partial coverage of question formats | ✅ — fully supported | ⚠️ — partial / in development | ❌ — not supported
