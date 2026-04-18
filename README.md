# xdAnswers

**🇺🇦 Українська** | [🇬🇧 English](README-en.md)

![GitHub Actions Workflow Status](https://img.shields.io/github/actions/workflow/status/aartzz/xdAnswers/build.yml)
![GitHub Repo stars](https://img.shields.io/github/stars/aartzz/xdAnswers?style=flat)

Безкоштовне розширення для Chrome, яке розв'язує тестові питання за допомогою ШІ.

Працює з коробки — вбудовані безкоштовні провайдери, API-ключ не потрібен.
> [!IMPORTANT]  
> **Бета** — баги бувають. [Звітуйте про них](https://github.com/aartzz/xdAnswers/issues).

![Screenshot](images/README/ui.png)

## Можливості

- **Безкоштовно за замовчуванням** — 3 вбудовані провайдери Unturf (Hermes, Qwen, Qwen Vision) без API-ключа
- **Будь-який OpenAI-сумісний API** — OpenAI, Anthropic, Gemini, DeepSeek, Groq, локальний Ollama, що завгодно
- **Розпізнавання зображень** — обробляє зображення в питаннях та варіантах відповідей
- **Тихі режими** — індикатори (точка біля правильної відповіді), заголовок сторінки або стелс (тільки буфер обміну)
- **Автовідповідь** — автоматично обирає правильний варіант
- **Плаваючий помічник** — перетягуваний, показує відповідь + пояснення + витрачений час
- **Мультиязичність** — інтерфейс українською, російською та англійською
- **Кастомні теми** — обери готову або створи свою з + кнопкою

## Встановлення

### Десктоп (Chrome, Brave, Edge, Vivaldi)

1. Перейдіть до [Releases](https://github.com/aartzz/xdAnswers/releases), завантажте останній `xdAnswers-chrome-*.zip`
2. Розпакуйте
3. Відкрийте `chrome://extensions`, увімкніть **Режим розробника** (справа вгорі)
4. Натисніть **Завантажити розпаковане розширення**, оберіть розпаковану папку

### Мобільний (Kiwi Browser)

1. Встановіть [Kiwi Browser](https://play.google.com/store/apps/details?id=com.kiwibrowser.browser) з Play Store
2. Перейдіть до [Releases](https://github.com/aartzz/xdAnswers/releases), завантажте останній `xdAnswers-chrome-*.zip`
3. Відкрийте `kiwi://extensions`, увімкніть **Режим розробника**
4. Натисніть **Завантажити розпаковане розширення**, оберіть розпаковану папку

### Firefox

Розширення підписано Mozilla — працює на будь-якій версії Firefox без додаткових налаштувань.

1. Завантажте `xdAnswers-firefox-*.xpi` з [Releases](https://github.com/aartzz/xdAnswers/releases)
2. Перетягніть файл `.xpi` у вікно Firefox → підтвердіть встановлення

### Збірка з вихідного коду

Потрібен [Node.js](https://nodejs.org/) 18+ (щоб був доступний `npm`).

```bash
git clone https://github.com/aartzz/xdAnswers.git
cd xdAnswers
npm install
```

Далі оберіть ціль:

```bash
# Firefox — підписаний .xpi у ./build/xdAnswers-firefox-<version>.xpi
npm run sign:firefox

# Chrome/Brave/Edge/Vivaldi — готовий .zip у ./build/xdAnswers-chrome-<version>.zip
npm run build:chrome
```

> [!NOTE]
> Для підписання Firefox-розширення потрібні облікові дані Mozilla Add-ons API. Створи файл `.env` у корені проєкту (дивись `.env.example`) або передай їх через змінні середовища `WEB_EXT_API_KEY` / `WEB_EXT_API_SECRET`.

Готові артефакти лежать у папці `./build`. Далі встановлюйте їх так само, як і реліз-файли (див. розділи вище).

> [!TIP]
> Скрипти `build:firefox` / `build:chrome` крос-платформні (працюють на Windows, macOS, Linux) — вони автоматично генерують правильний `manifest.json` для вибраного браузера, пакують розширення через `web-ext` і прибирають тимчасові файли.

### Режим розробки (hot reload)

Для ітеративної розробки зручно використовувати режим `web-ext run`, який запускає тимчасовий профіль браузера з уже завантаженим розширенням і автоматично перезавантажує його при змінах у файлах:

```bash
# Спочатку згенеруйте manifest.json для потрібного браузера
node scripts/build-manifest.js firefox    # або chrome

# Firefox — відкриється тимчасовий Firefox з розширенням
npx web-ext run

# Chrome/Chromium (потребує встановленого Chrome)
npx web-ext run -t chromium
```

Після завершення сесії приберіть згенерований `manifest.json` командою `npm run clean`.

## Використання

1. Натисніть іконку розширення → відкриються налаштування
2. Оберіть провайдер (Unturf Vision за замовчуванням, працює безкоштовно)
3. Якщо використовуєте платний API, вставте свій ключ
4. Відкрийте тест на підтримуваному сайті — помічник з'явиться автоматично

## Підтримувані сайти

| Сайт | URL | Статус |
|------|-----|--------|
| НаУрок | [naurok.com.ua](https://naurok.com.ua) | стабільний |
| Всеосвіта | [vseosvita.ua](https://vseosvita.ua) | бета |
| JustClass | [justclass.com.ua](https://justclass.com.ua) | бета |
| Google Forms | [docs.google.com/forms](https://docs.google.com/forms) | бета |
| Microsoft Forms | [forms.office.com](https://forms.office.com) | бета |
