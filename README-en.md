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

- **Free by default** — 3 built-in Unturf providers (Hermes, Qwen, Qwen Vision) with no API key
- **Any OpenAI-compatible API** — OpenAI, Anthropic, Gemini, DeepSeek, Groq, local Ollama, anything
- **Image recognition** — handles images in questions and answer options
- **Silent modes** — indicators (dot next to correct answer), page title, or clipboard-only stealth
- **Auto-answer** — automatically selects the correct option
- **Floating helper** — draggable, shows answer + reasoning + elapsed time

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

| Site | URL | Status |
|------|-----|--------|
| NaUrok | [naurok.com.ua](https://naurok.com.ua) | stable |
| Vseosvita | [vseosvita.ua](https://vseosvita.ua) | beta |
| JustClass | [justclass.com.ua](https://justclass.com.ua) | beta |
| Kahoot! | [kahoot.it](https://kahoot.it) | beta |
| Classtime | [classtime.com](https://classtime.com) | beta |
| MiyKlas | [miyklas.com.ua](https://miyklas.com.ua) | beta |
| LCloud | [lcloud.in.ua](https://lcloud.in.ua) | beta |
| Google Forms | [docs.google.com/forms](https://docs.google.com/forms) | beta |
| Microsoft Forms | [forms.office.com](https://forms.office.com) | beta |
