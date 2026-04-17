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

> [!NOTE]  
> Потрібен [Nightly](https://play.google.com/store/apps/details?id=org.mozilla.fenix) (мобільний) або [ESR/Dev/Nightly](https://www.mozilla.org/firefox/organizations) (десктоп).

1. В адресному рядку: `about:config` → прийміть ризик → встановіть `xpinstall.signatures.required` у `false`
2. Завантажте `xdAnswers-firefox-*.xpi` з [Releases](https://github.com/aartzz/xdAnswers/releases)
3. Перетягніть файл `.xpi` у вікно Firefox

### З вихідного коду

```bash
git clone https://github.com/aartzz/xdAnswers.git
node scripts/build-manifest.js
```
Потім завантажте як розпаковане розширення (див. вище).

## Використання

1. Натисніть іконку розширення → відкриються налаштування
2. Оберіть провайдер (Unturf Vision за замовчуванням, працює безкоштовно)
3. Якщо використовуєте платний API, вставте свій ключ
4. Відкрийте тест на підтримуваному сайті — помічник з'явиться автоматично

## Підтримувані сайти

| Сайт | URL | Статус |
|------|-----|--------|
| NaUrok | [naurok.com.ua](https://naurok.com.ua) | стабільний |
| Vseosvita | [vseosvita.ua](https://vseosvita.ua) | бета |
| JustClass | [justclass.com.ua](https://justclass.com.ua) | бета |
| Google Forms | [docs.google.com/forms](https://docs.google.com/forms) | бета |
