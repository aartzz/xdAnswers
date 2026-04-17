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

1. Install [Kiwi Browser](https://play.google.com/store/apps/details?id=com.kiwibrowser.browser) from Play Store
2. Go to [Releases](https://github.com/aartzz/xdAnswers/releases), download the latest `xdAnswers-chrome-*.zip`
3. Open `kiwi://extensions`, enable **Developer mode**
4. Click **Load unpacked**, select the unzipped folder

### Firefox

> [!NOTE]  
> Requires [Nightly](https://play.google.com/store/apps/details?id=org.mozilla.fenix) (mobile) or [ESR/Dev/Nightly](https://www.mozilla.org/firefox/organizations) (desktop).

1. In address bar: `about:config` → accept risk → set `xpinstall.signatures.required` to `false`
2. Download `xdAnswers-firefox-*.xpi` from [Releases](https://github.com/aartzz/xdAnswers/releases)
3. Drag the `.xpi` file into a Firefox window

### From source

```bash
git clone https://github.com/aartzz/xdAnswers.git
node scripts/build-manifest.js
```
Then load unpacked as above.

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
| Google Forms | [docs.google.com/forms](https://docs.google.com/forms) | beta |
