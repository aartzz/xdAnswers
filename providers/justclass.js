// xdAnswers provider — JustClass (justclass.com.ua/hw/*)
// Reads the public homework answer key and drives Angular Material mat-select widgets.
(function () {
    'use strict';

    const API_PREFIX = '/b/api/public/homework/by-hash/';
    const PANEL_SELECTOR = '.mat-select-panel';
    const PANEL_WAIT_MS = 1400;
    const OPTION_WAIT_MS = 1000;

    let initialized = false;
    let apiCache = null;          // { hash, byId, trainings }
    let apiPromise = null;        // { hash, promise }
    let apiError = null;          // { hash, at, message }
    let scanTimer = null;
    let busy = false;
    let queuedScan = null;
    let lastHash = null;
    let lastScanKey = '';
    let lastScanWidgets = [];
    let lastQuestionKey = '';
    let answeredKey = '';
    let retryCount = 0;
    let lastRenderKey = '';
    let oneClickRoot = null;
    let oneClickHandler = null;
    let aiKey = '';                  // question key for which the AI fallback was requested
    let aiApplyAllowed = false;      // whether the AI answer may be selected automatically
    const aiEntryMap = new WeakMap(); // widget -> { correctValues } produced from the AI answer

    const waitForUtils = setInterval(async () => {
        if (window.xdAnswers && window.xdAnswers.loadSettings) {
            clearInterval(waitForUtils);
            try {
                await window.xdAnswers.loadSettings();
            } catch (e) {
                console.warn('[xdAnswers] JustClass: settings load failed, continuing with defaults', e);
            }
            initJustClass();
        }
    }, 50);

    function I() { return window.xdAnswers._internal; }

    function norm(s) {
        return String(s == null ? '' : s)
            .replace(/\u00a0/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function lower(s) {
        return norm(s).toLocaleLowerCase('uk');
    }

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function isVisible(el) {
        if (!el || !el.isConnected) return false;
        const style = getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
        return el.getClientRects().length > 0;
    }

    function getHash() {
        const m = location.pathname.match(/\/hw\/([^/?#]+)/);
        if (!m) return null;
        try { return decodeURIComponent(m[1]); } catch (e) { return m[1]; }
    }

    function getQuestionNumber() {
        const widgets = getWidgets();
        const scope = widgets.length
            ? (widgets[0].closest('.preview-block') || widgets[0].closest('justkids-training-preview'))
            : null;

        const candidates = [];
        if (scope) candidates.push(scope);
        document.querySelectorAll('.preview-block, justkids-training-preview').forEach(el => {
            if (isVisible(el)) candidates.push(el);
        });
        candidates.push(document.body);

        for (const root of candidates) {
            const text = norm(root && root.innerText);
            const m = text.match(/(\d+)\s*із\s*(\d+)/i);
            if (m) return parseInt(m[1], 10) || 0;
        }
        return 0;
    }

    function getWidgets() {
        return Array.from(document.querySelectorAll('justkids-select-dynamic'))
            .filter(isVisible);
    }

    function getSelect(widget) {
        return widget ? widget.querySelector('mat-select') : null;
    }

    function getQuestionKey(widgets) {
        const ids = widgets.map(w => w.id || '').join(',');
        return (getHash() || '') + '|' + getQuestionNumber() + '|' + ids;
    }

    function sameWidgets(a, b) {
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) {
            if (a[i] !== b[i]) return false;
        }
        return true;
    }

    function rowLabel(widget) {
        let node = widget;
        for (let depth = 0; depth < 3 && node; depth++) {
            let prev = node.previousElementSibling;
            while (prev && !norm(prev.textContent)) prev = prev.previousElementSibling;
            if (prev && !prev.querySelector('justkids-select-dynamic, mat-select, .select-wrapper')) {
                const text = norm(prev.textContent);
                if (text && text.length <= 180) return text;
            }
            node = node.parentElement;
        }
        return '';
    }

    // ---------------------------------------------------------------------
    // Answer key
    // ---------------------------------------------------------------------

    function decodeValue(value) {
        const text = String(value == null ? '' : value);
        try { return decodeURIComponent(text); } catch (e) { return text; }
    }

    function decodeTokens(html) {
        const map = new Map();
        const re = /\[#:([^:\]]+):([A-Za-z0-9+/=]+)\]/g;
        let match;
        while ((match = re.exec(String(html || '')))) {
            try {
                const decoded = JSON.parse(window.atob(match[2]));
                let options = decoded && decoded.options;
                if (typeof options === 'string') options = JSON.parse(options);
                if (Array.isArray(options)) {
                    map.set(match[1], options.map(o => ({
                        value: decodeValue(o && o.value),
                        correct: String(o && o.text).toLowerCase() === 'true'
                    })));
                }
            } catch (e) {
                // Ignore a malformed token; elements[] remains the primary source.
            }
        }
        return map;
    }

    function extractEntries(training) {
        const translations = training && training.translations || {};
        const locale = training.currentLocale || training.defaultLocale || 'uk';
        const translation = translations[locale]
            || translations.uk
            || Object.values(translations)[0]
            || {};
        const payload = translation.payload || {};

        let elements = Array.isArray(payload.elements) ? payload.elements : [];
        const tokenOptions = decodeTokens(payload.html || '');

        if (!elements.length && tokenOptions.size) {
            elements = Array.from(tokenOptions.entries()).map(([answerId, options]) => ({
                answerId: answerId,
                options: options
            }));
        }

        return elements.map(el => {
            let options = Array.isArray(el.options) ? el.options : [];
            let normalized = options.map(o => ({
                value: norm(o && o.value),
                correct: !!(o && o.correct)
            }));

            if (!normalized.length && tokenOptions.has(el.answerId)) {
                normalized = tokenOptions.get(el.answerId).map(o => ({
                    value: norm(o.value),
                    correct: !!o.correct
                }));
            }

            return {
                answerId: el.answerId,
                options: normalized,
                correctValues: normalized.filter(o => o.correct && o.value).map(o => o.value),
                tooltip: norm(el.tooltip)
            };
        });
    }

    function buildCache(hash, data) {
        const byId = new Map();
        const trainings = [];
        const list = Array.isArray(data.trainings)
            ? data.trainings
            : (Array.isArray(data.sections)
                ? data.sections.flatMap(s => Array.isArray(s.trainings) ? s.trainings : [])
                : []);

        for (const training of list) {
            const entries = extractEntries(training);
            entries.forEach(entry => {
                if (entry.answerId) byId.set(entry.answerId, entry);
            });
            trainings.push({ entries });
        }

        return { hash, byId, trainings };
    }

    async function fetchApi(hash) {
        const url = new URL(API_PREFIX + encodeURIComponent(hash), location.origin).href;
        let lastError = null;

        try {
            const response = await fetch(url, {
                method: 'GET',
                credentials: 'same-origin',
                headers: { 'Accept': 'application/json, text/plain, */*' }
            });
            if (!response.ok) throw new Error('HTTP ' + response.status);
            return await response.json();
        } catch (err) {
            lastError = err;
        }

        // Fallback through the extension background fetch (useful if page CSP
        // or a browser context blocks the direct same-origin request).
        try {
            const response = await window.xdAnswers.makeRequest({
                method: 'GET',
                url: url,
                headers: { 'Accept': 'application/json, text/plain, */*' },
                responseType: 'text',
                timeout: 30000
            });
            return JSON.parse(response.data);
        } catch (err) {
            throw lastError || err;
        }
    }

    async function ensureApi() {
        const hash = getHash();
        if (!hash) return null;
        if (apiCache && apiCache.hash === hash) return apiCache;

        if (apiError && apiError.hash === hash && Date.now() - apiError.at < 8000) {
            throw new Error(apiError.message);
        }

        if (apiPromise && apiPromise.hash === hash) return apiPromise.promise;

        const promise = fetchApi(hash)
            .then(data => {
                const cache = buildCache(hash, data);
                apiCache = cache;
                apiError = null;
                apiPromise = null;
                return cache;
            })
            .catch(err => {
                apiPromise = null;
                apiError = { hash, at: Date.now(), message: err.message || String(err) };
                throw err;
            });

        apiPromise = { hash, promise };
        return promise;
    }

    function findEntry(api, widget, index) {
        if (!api) return null;
        if (widget.id && api.byId.has(widget.id)) return api.byId.get(widget.id);

        // Fallback for a widget without an id: the page shows one training at a
        // time, and training order matches the "N із M" counter.
        const number = getQuestionNumber();
        const training = number > 0 ? api.trainings[number - 1] : null;
        return training && training.entries[index] || null;
    }

    // ---------------------------------------------------------------------
    // Angular Material mat-select driving
    // ---------------------------------------------------------------------

    function getVisiblePanel() {
        const panels = Array.from(document.querySelectorAll(PANEL_SELECTOR)).filter(isVisible);
        return panels[panels.length - 1] || null;
    }

    function panelForSelect(select) {
        const owns = select.getAttribute('aria-owns');
        if (owns) {
            const panel = document.getElementById(owns);
            if (panel && panel.matches(PANEL_SELECTOR) && isVisible(panel)) return panel;
        }
        return null;
    }

    function isDisabled(select) {
        return !select
            || select.getAttribute('aria-disabled') === 'true'
            || select.classList.contains('mat-select-disabled')
            || select.hasAttribute('disabled');
    }

    async function waitFor(fn, timeout, interval) {
        const end = Date.now() + (timeout || 1000);
        const step = interval || 40;
        while (Date.now() < end) {
            try {
                const value = fn();
                if (value) return value;
            } catch (e) {}
            await sleep(step);
        }
        return null;
    }

    async function closePanels() {
        if (!getVisiblePanel()) return;

        document.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'Escape',
            code: 'Escape',
            keyCode: 27,
            which: 27,
            bubbles: true
        }));
        await sleep(120);

        if (!getVisiblePanel()) return;

        const backdrop = document.querySelector('.cdk-overlay-backdrop');
        if (backdrop) {
            backdrop.click();
            await sleep(120);
        }
    }

    function selectedText(select) {
        if (!select) return '';
        const textEl = select.querySelector('.mat-select-value-text');
        if (textEl) return norm(textEl.textContent);

        const valueEl = select.querySelector('.mat-select-value');
        if (!valueEl) return '';
        if (valueEl.querySelector('.mat-select-placeholder')) return '';
        return norm(valueEl.textContent);
    }

    function isAlreadyCorrect(widget, entry) {
        const select = getSelect(widget);
        if (!select || !entry || !entry.correctValues.length) return false;
        const selected = lower(selectedText(select));
        if (!selected) return false;
        return entry.correctValues.some(value => lower(value) === selected);
    }

    function optionText(option) {
        const textEl = option.querySelector('.mat-option-text');
        return norm(textEl ? textEl.textContent : option.textContent);
    }

    function similarity(a, b) {
        if (a === b) return 1;
        if (!a || !b) return 0;
        if (a.length >= 3 && b.length >= 3 && (a.includes(b) || b.includes(a))) return 0.9;

        const m = a.length;
        const n = b.length;
        if (Math.abs(m - n) / Math.max(m, n) > 0.6) return 0;

        let prev = new Array(n + 1);
        for (let j = 0; j <= n; j++) prev[j] = j;

        for (let i = 1; i <= m; i++) {
            const current = [i];
            for (let j = 1; j <= n; j++) {
                current[j] = Math.min(
                    current[j - 1] + 1,
                    prev[j] + 1,
                    prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
                );
            }
            prev = current;
        }

        return 1 - prev[n] / Math.max(m, n);
    }

    function matchOption(options, values) {
        const wanted = values.map(lower).filter(Boolean);
        if (!wanted.length) return null;

        for (const value of wanted) {
            const exact = options.find(option => lower(optionText(option)) === value);
            if (exact) return exact;
        }

        for (const value of wanted) {
            if (value.length < 3) continue;
            const contains = options.find(option => {
                const text = lower(optionText(option));
                return text.length >= 3 && (text.includes(value) || value.includes(text));
            });
            if (contains) return contains;
        }

        let best = null;
        let bestScore = 0;
        for (const option of options) {
            const text = lower(optionText(option));
            for (const value of wanted) {
                const score = similarity(text, value);
                if (score > bestScore) {
                    bestScore = score;
                    best = option;
                }
            }
        }
        return bestScore >= 0.72 ? best : null;
    }

    async function selectWidget(widget, entry) {
        const select = getSelect(widget);
        if (!select || isDisabled(select)) return false;
        if (isAlreadyCorrect(widget, entry)) return true;

        let panel = null;
        if (select.getAttribute('aria-expanded') === 'true') {
            panel = panelForSelect(select) || getVisiblePanel();
        } else {
            await closePanels();
            const trigger = select.querySelector('.mat-select-trigger') || select;
            trigger.click();
            panel = await waitFor(() => panelForSelect(select) || getVisiblePanel(), PANEL_WAIT_MS);

            if (!panel && select.getAttribute('aria-expanded') !== 'true') {
                select.click();
                panel = await waitFor(() => panelForSelect(select) || getVisiblePanel(), PANEL_WAIT_MS);
            }
        }

        if (!panel) {
            await closePanels();
            return false;
        }

        const options = await waitFor(() => {
            const list = Array.from(panel.querySelectorAll('mat-option'));
            return list.length ? list : null;
        }, OPTION_WAIT_MS);

        if (!options) {
            await closePanels();
            return false;
        }

        const option = matchOption(options, entry.correctValues);
        if (!option) {
            await closePanels();
            return false;
        }

        option.click();
        await waitFor(() => isAlreadyCorrect(widget, entry), 900, 50);
        await closePanels();
        return isAlreadyCorrect(widget, entry);
    }

    async function applySelections(widgets, entries, triggerKey, userTriggered) {
        const settings = window.xdAnswers.settings || {};
        if (!userTriggered && settings.autoAnswerCooldown) {
            const cooldown = Math.min(Math.max(0, Number(settings.autoAnswerCooldown) || 0), 5000);
            if (cooldown) await sleep(cooldown);
            if (getQuestionKey(getWidgets()) !== triggerKey) return false;
        }

        let allDone = true;
        for (let i = 0; i < widgets.length; i++) {
            const widget = widgets[i];
            const entry = entries[i];
            if (!widget.isConnected) return false;
            if (!entry || !entry.correctValues.length) {
                allDone = false;
                continue;
            }
            if (isAlreadyCorrect(widget, entry)) continue;

            const ok = await selectWidget(widget, entry);
            if (!ok) allDone = false;
            if (getQuestionKey(getWidgets()) !== triggerKey) return false;
            await sleep(80);
        }
        return allDone;
    }

    // ---------------------------------------------------------------------
    // AI fallback (answer key API unavailable)
    // ---------------------------------------------------------------------

    function aiValues(answerText, count) {
        const cleaned = String(answerText == null ? '' : answerText).trim();
        if (!cleaned || count < 1) return [];

        const pairs = new Map();
        cleaned.split(/[\n;]+/).forEach(chunk => {
            const m = norm(chunk).match(/^(\d+)\s*[=:.)\-]\s*(.+)$/);
            if (!m) return;
            const index = parseInt(m[1], 10);
            if (index >= 1 && index <= count && !pairs.has(index)) pairs.set(index, m[2].trim());
        });

        if (count === 1) {
            const single = pairs.get(1)
                || norm(cleaned).replace(/^\s*(?:answer|відповідь)\s*[:\-]\s*/i, '');
            return [single.split(/\n+/)[0].trim()];
        }

        const values = [];
        for (let i = 1; i <= count; i++) values.push(pairs.get(i) || '');
        if (values.some(Boolean)) return values;

        const lines = cleaned.split(/[\n;]+/)
            .map(line => norm(line).replace(/^\d+\s*[=:.)\-]?\s*/, ''))
            .filter(Boolean);
        for (let i = 0; i < count; i++) values[i] = lines[i] || '';
        return values;
    }

    function aiEntry(values) {
        const seen = new Set();
        const correctValues = [];

        function push(value) {
            const clean = norm(value).replace(/[*`]+/g, '').replace(/^["'«»]+|["'«»]+$/g, '').trim();
            if (!clean) return;
            const key = lower(clean);
            if (seen.has(key)) return;
            seen.add(key);
            correctValues.push(clean);
        }

        (values || []).forEach(value => {
            push(value);

            const clean = norm(value).replace(/[*`]+/g, '').replace(/^["'«»]+|["'«»]+$/g, '').trim();
            clean.split(/[(),;:\u2014\u2013]|\s+-\s+/).forEach(part => push(part));

            const low = lower(clean);
            if (low === 'правда' || low === 'вірно' || low === 'true') push('Так');
            if (low === 'хиба' || low === 'неправда' || low === 'невірно' || low === 'false') push('Ні');
        });

        return correctValues.length ? { correctValues: correctValues, options: [] } : null;
    }

    async function readWidgetOptions(widget) {
        const select = getSelect(widget);
        if (!select || isDisabled(select)) return [];

        let panel = select.getAttribute('aria-expanded') === 'true'
            ? (panelForSelect(select) || getVisiblePanel())
            : null;

        if (!panel) {
            await closePanels();
            const trigger = select.querySelector('.mat-select-trigger') || select;
            trigger.click();
            panel = await waitFor(() => panelForSelect(select) || getVisiblePanel(), PANEL_WAIT_MS);
            if (!panel && select.getAttribute('aria-expanded') !== 'true') {
                select.click();
                panel = await waitFor(() => panelForSelect(select) || getVisiblePanel(), PANEL_WAIT_MS);
            }
        }

        let texts = [];
        if (panel) {
            const options = await waitFor(() => {
                const list = Array.from(panel.querySelectorAll('mat-option'));
                return list.length ? list : null;
            }, OPTION_WAIT_MS);
            if (options) texts = options.map(optionText).filter(Boolean);
        }

        await closePanels();
        return texts;
    }

    function questionStem(widgets) {
        const root = questionRoot(widgets);
        if (!root) return '';
        const clone = root.cloneNode(true);
        clone.querySelectorAll('justkids-select-dynamic').forEach(el => el.remove());
        return norm(clone.innerText || clone.textContent);
    }

    async function collectQuestionImages(widgets) {
        const root = questionRoot(widgets);
        if (!root || !window.xdAnswers.imageToBase64) return [];

        const urls = [];
        root.querySelectorAll('img').forEach(img => {
            if (!img.src || img.src.startsWith('data:image/gif')) return;
            if (img.closest('justkids-select-dynamic')) return;
            if ((img.width || img.naturalWidth || 0) < 40) return;
            if (!urls.includes(img.src)) urls.push(img.src);
        });

        const images = await Promise.all(urls.map(url =>
            Promise.resolve(window.xdAnswers.imageToBase64(url)).catch(() => null)
        ));
        return images.filter(Boolean);
    }

    async function buildAiPayload(widgets) {
        const stem = questionStem(widgets);
        const rows = [];
        let hasOptions = false;

        for (let i = 0; i < widgets.length; i++) {
            const widget = widgets[i];
            const entry = apiCache ? findEntry(apiCache, widget, i) : null;
            let options = entry ? entry.options.map(option => option.value).filter(Boolean) : [];

            if (!options.length) options = await readWidgetOptions(widget);
            if (options.length) hasOptions = true;

            rows.push({
                label: rowLabel(widget) || ('Пункт ' + (i + 1)),
                options: options
            });
        }

        if (!hasOptions) return null;

        let text;
        let optionsText = '';

        if (rows.length === 1) {
            text = stem || 'Завдання JustClass.';
            optionsText = rows[0].options.join('\n');
        } else {
            text = 'Це завдання з кількома пунктами — для кожного пункту треба вибрати правильний варіант.\n'
                + 'Відповідай СТРОГО у форматі: 1=варіант; 2=варіант; ... (номер пункту = вибраний варіант).\n'
                + 'Використовуй ТОЧНИЙ текст варіанту зі списку.\n\n';
            if (stem) text += 'Завдання: ' + stem + '\n\n';
            text += 'Пункти:';
            rows.forEach((row, index) => {
                text += '\n' + (index + 1) + '. ' + row.label + ' — варіанти: ' + row.options.join(' | ');
            });
        }

        return {
            text: text,
            optionsText: optionsText,
            base64Images: await collectQuestionImages(widgets),
            topic: 'JustClass'
        };
    }

    async function applyAiAnswer(answerText, parsed) {
        const widgets = getWidgets();
        if (!widgets.length) return;
        const key = getQuestionKey(widgets);
        if (aiKey && key !== aiKey) {
            console.warn('[xdAnswers] JustClass: AI answer arrived for an older question, skipping');
            return;
        }
        aiKey = key;

        const values = aiValues(answerText, widgets.length);
        const entries = widgets.map((widget, index) => aiEntry(values[index]));
        entries.forEach((entry, index) => {
            if (entry) aiEntryMap.set(widgets[index], entry);
        });

        if (aiApplyAllowed) {
            await applySelections(widgets, entries, key, true);
        }

        parsed = parsed || {};
        parsed._justclass = true;
        parsed._justclassShort = entries
            .map(entry => entry ? entry.correctValues[0] : '')
            .filter(Boolean)
            .join('; ');
        window.xdAnswers.lastParsedResponse = parsed;

        applyVisuals(parsed);
    }

    async function aiFallback(widgets, options, key) {
        const settings = window.xdAnswers.settings || {};
        const oneclick = settings.silentMode === 'oneclick';

        if (oneclick && !options.userTriggered) {
            answeredKey = key;
            applyVisuals();
            return;
        }

        if (aiKey === key) {
            answeredKey = key;
            applyVisuals();
            return;
        }

        if (window.xdAnswers.isProcessingAI) {
            // Another AI request is already running; re-check once it finishes.
            setTimeout(() => scheduleScan(0), 900);
            return;
        }

        let payload = null;
        try {
            payload = await buildAiPayload(widgets);
        } catch (err) {
            console.warn('[xdAnswers] JustClass: failed to prepare AI fallback payload', err);
        }

        if (getQuestionKey(getWidgets()) !== key) return;

        if (!payload) {
            renderError(new Error('ключ відповідей недоступний, а варіанти завдання прочитати не вдалося'));
            answeredKey = key;
            return;
        }

        aiApplyAllowed = !!options.userTriggered || !!settings.autoAnswer || oneclick;
        aiKey = key;
        answeredKey = key;

        if (oneclick && options.userTriggered) {
            window.xdAnswers._oneClickUserTriggered = true;
        }

        window.xdAnswers._customAutoAnswer = applyAiAnswer;
        window.xdAnswers.processQuestion(payload);
    }

    // ---------------------------------------------------------------------
    // Answer text / helper
    // ---------------------------------------------------------------------

    function buildParsed(widgets, entries) {
        const lines = [];
        const values = [];

        widgets.forEach((widget, index) => {
            const entry = entries[index];
            if (!entry || !entry.correctValues.length) return;
            const value = entry.correctValues.join(' / ');
            values.push(value);

            if (widgets.length > 1) {
                const label = rowLabel(widget);
                lines.push((label ? (index + 1) + '. ' + label + ' — ' : (index + 1) + '. ') + '**' + value + '**');
            } else {
                lines.push('**' + value + '**');
            }
        });

        if (!lines.length) {
            return {
                answer: '',
                explanation: 'У ключі відповідей JustClass не знайдено відповіді для цього завдання.',
                _justclass: true,
                _justclassShort: ''
            };
        }

        return {
            answer: lines.join('\n'),
            explanation: '',
            _justclass: true,
            _justclassShort: values.join('; '),
            isStructured: true
        };
    }

    function plainAnswer(parsed) {
        const text = (parsed && (parsed._justclassShort || parsed.answer)) || '';
        return norm(String(text).replace(/\*\*/g, '').replace(/\n+/g, '; '));
    }

    function renderHelper(parsed, force) {
        const hash = getHash() || '';
        const key = hash + '|' + getQuestionNumber() + '|' + (parsed.answer || '') + '|' + (parsed.explanation || '');
        if (!force && key === lastRenderKey
            && window.xdAnswers.helperContainer
            && document.body.contains(window.xdAnswers.helperContainer)) {
            return;
        }
        lastRenderKey = key;

        if (!window.xdAnswers.helperContainer) window.xdAnswers.createUI();
        if (!document.body.contains(window.xdAnswers.helperContainer)) {
            window.xdAnswers.attachAndPositionHelper();
        }

        const div = window.xdAnswers.answerContentDiv;
        if (!div) return;
        const html = I().renderParsedResponse(parsed);
        div.innerHTML = html || '<div class="xd-answer">Готово.</div>';
    }

    function renderError(err) {
        const parsed = {
            answer: '',
            explanation: 'Не вдалося завантажити ключ відповідей JustClass: ' + (err && err.message ? err.message : String(err)),
            _justclass: true,
            _justclassShort: ''
        };
        window.xdAnswers.lastParsedResponse = parsed;
        renderHelper(parsed, false);
    }

    // ---------------------------------------------------------------------
    // Visuals and silent modes
    // ---------------------------------------------------------------------

    function clearMarks() {
        document.querySelectorAll('.xd-jc-highlight').forEach(el => {
            el.classList.remove('xd-jc-highlight', 'xd-highlight-correct');
            el.style.removeProperty('outline');
            el.style.removeProperty('outline-offset');
            el.style.removeProperty('border-radius');
        });
        document.querySelectorAll('.xd-jc-dot').forEach(el => el.remove());
        document.querySelectorAll('justkids-select-dynamic').forEach(el => el.style.removeProperty('position'));
    }

    function markWidget(widget, entry, indicator) {
        const formField = widget.querySelector('mat-form-field') || widget;

        if (indicator) {
            widget.style.setProperty('position', 'relative', 'important');
            const dot = document.createElement('span');
            dot.className = 'xd-indicator-dot xd-jc-dot';
            dot.style.cssText = 'position:absolute;top:-3px;right:-3px;width:8px;height:8px;background:#22c55e;border-radius:50%;box-shadow:0 0 4px rgba(34,197,94,0.5);pointer-events:none;z-index:2;';
            dot.title = entry.correctValues.join(', ');
            widget.appendChild(dot);
            return;
        }

        formField.classList.add('xd-highlight-correct', 'xd-jc-highlight');
        formField.style.setProperty('outline', '2px solid #22c55e', 'important');
        formField.style.setProperty('outline-offset', '2px', 'important');
        formField.style.setProperty('border-radius', '8px', 'important');
    }

    function currentWidgetEntries() {
        const widgets = getWidgets();
        if (!widgets.length) return null;

        const entries = widgets.map((widget, index) => {
            const apiEntry = apiCache ? findEntry(apiCache, widget, index) : null;
            if (apiEntry && apiEntry.correctValues.length) return apiEntry;
            return aiEntryMap.get(widget) || null;
        });

        if (!entries.some(entry => entry && entry.correctValues.length)) return null;
        return { widgets, entries };
    }

    function clearOneClick() {
        if (oneClickRoot && oneClickHandler) {
            oneClickRoot.removeEventListener('click', oneClickHandler, true);
            oneClickRoot.classList.remove('xd-oneclick-ready');
            oneClickRoot.style.removeProperty('cursor');
        }
        oneClickRoot = null;
        oneClickHandler = null;
    }

    function registerOneClick(root) {
        if (!root) return;
        if (oneClickRoot === root && oneClickHandler) return;
        clearOneClick();

        oneClickRoot = root;
        oneClickRoot.classList.add('xd-oneclick-ready');
        oneClickRoot.style.cursor = 'pointer';

        oneClickHandler = async (event) => {
            if (window.xdAnswers._autoSelecting) return;
            if (event && event.target && event.target.closest && event.target.closest('.ollama-helper-container')) return;
            await runScan({ force: true, userTriggered: true });
        };
        oneClickRoot.addEventListener('click', oneClickHandler, true);
    }

    function questionRoot(widgets) {
        if (!widgets.length) return null;
        return widgets[0].closest('justkids-text-select')
            || widgets[0].closest('.preview-content')
            || widgets[0].closest('justkids-training-preview')
            || widgets[0].parentElement;
    }

    function applyVisuals(parsedArg) {
        const settings = window.xdAnswers.settings || {};
        const mode = settings.silentMode || '';
        const parsed = parsedArg || window.xdAnswers.lastParsedResponse || {};

        if (mode !== 'oneclick') clearOneClick();
        clearMarks();

        if (mode === 'oneclick') {
            registerOneClick(questionRoot(getWidgets()));
            return;
        }

        if (mode === 'ghost') {
            if (!window.xdAnswers._originalTitle) {
                window.xdAnswers._originalTitle = document.title;
            }
            const short = plainAnswer(parsed).substring(0, 60);
            document.title = '[' + short + '] ' + window.xdAnswers._originalTitle;
            return;
        }

        if (mode === 'stealth') {
            const text = plainAnswer(parsed);
            if (text) {
                try { navigator.clipboard.writeText(text); } catch (e) {}
            }
            return;
        }

        const found = currentWidgetEntries();
        if (!found) return;

        if (mode === 'indicators') {
            found.widgets.forEach((widget, index) => {
                const entry = found.entries[index];
                if (entry && entry.correctValues.length) markWidget(widget, entry, true);
            });
            return;
        }

        if (mode !== '') return;
        if (!settings.highlightCorrect) return;

        found.widgets.forEach((widget, index) => {
            const entry = found.entries[index];
            if (entry && entry.correctValues.length) markWidget(widget, entry, false);
        });
    }

    function applyJustClassSilent(parsed) {
        applyVisuals(parsed);
    }

    function hookSilentMode() {
        const internal = I();
        if (!internal.applySilentMode || internal.__xdJustClassWrapped) return;
        const original = internal.applySilentMode;
        internal.applySilentMode = function (answerText, parsed) {
            if (parsed && parsed._justclass) {
                applyJustClassSilent(parsed);
                return;
            }
            return original.apply(this, arguments);
        };
        internal.__xdJustClassWrapped = true;
    }

    // ---------------------------------------------------------------------
    // Scan loop
    // ---------------------------------------------------------------------

    function scheduleScan(delay, options) {
        clearTimeout(scanTimer);
        scanTimer = setTimeout(() => {
            scanTimer = null;
            runScan(options || {});
        }, delay);
    }

    async function runScan(options) {
        options = options || {};
        if (!initialized) return;
        if (!getHash()) return;

        if (busy) {
            queuedScan = options;
            return;
        }
        busy = true;

        try {
            await scan(options);
        } catch (err) {
            console.warn('[xdAnswers] JustClass scan failed:', err);
            renderError(err);
        } finally {
            busy = false;
            if (queuedScan) {
                const next = queuedScan;
                queuedScan = null;
                scheduleScan(120, next);
            }
        }
    }

    async function scan(options) {
        const hash = getHash();
        if (!hash) return;

        const widgets = getWidgets();
        if (!widgets.length) {
            lastScanKey = '';
            lastScanWidgets = [];
            lastQuestionKey = '';
            answeredKey = '';
            aiKey = '';
            clearMarks();
            clearOneClick();
            return;
        }

        const key = getQuestionKey(widgets);
        if (!options.force
            && key === lastScanKey
            && sameWidgets(widgets, lastScanWidgets)
            && ((apiCache && apiCache.hash === hash) || aiKey === key)) {
            if (window.xdAnswers.helperContainer && !document.body.contains(window.xdAnswers.helperContainer)) {
                window.xdAnswers.attachAndPositionHelper();
            }
            return;
        }

        lastScanKey = key;
        lastScanWidgets = widgets;

        if (key !== lastQuestionKey) {
            retryCount = 0;
            lastQuestionKey = key;
        }
        if (options.force) {
            answeredKey = '';
            retryCount = 0;
        }

        const settings = window.xdAnswers.settings || {};

        let api = null;
        try {
            api = await ensureApi();
        } catch (err) {
            console.warn('[xdAnswers] JustClass: answer key unavailable, falling back to AI', err);
        }
        if (getHash() !== hash) return;

        const currentWidgets = getWidgets();
        if (!currentWidgets.length) return;
        const entries = currentWidgets.map((widget, index) => api ? findEntry(api, widget, index) : null);
        const hasFullKey = entries.length > 0
            && entries.every(entry => entry && entry.correctValues.length);

        if (!hasFullKey) {
            await aiFallback(currentWidgets, options, key);
            return;
        }
        aiKey = '';

        const parsed = buildParsed(currentWidgets, entries);
        window.xdAnswers.lastParsedResponse = parsed;
        renderHelper(parsed, !!options.force);

        const auto = options.userTriggered
            || (settings.autoAnswer && settings.silentMode !== 'oneclick');

        if (auto && (options.force || key !== answeredKey)) {
            const ok = await applySelections(currentWidgets, entries, key, !!options.userTriggered);
            if (getHash() !== hash) return;
            if (getQuestionKey(getWidgets()) !== key) return;

            answeredKey = key;
            if (!ok && retryCount < 2) {
                retryCount++;
                setTimeout(() => runScan({ force: true }), 700);
            }
        } else if (!auto) {
            answeredKey = key;
        }

        if (getHash() !== hash) return;
        applyVisuals();
    }

    // ---------------------------------------------------------------------
    // Wiring
    // ---------------------------------------------------------------------

    function initJustClass() {
        if (initialized) return;
        initialized = true;

        console.log('[xdAnswers] JustClass provider loaded');
        lastHash = getHash();
        hookSilentMode();

        window.xdAnswers.onRefresh = () => {
            lastScanKey = '';
            lastQuestionKey = '';
            answeredKey = '';
            retryCount = 0;
            aiKey = '';
            scheduleScan(0, { force: true });
        };

        // Hash changes (SPA navigation) invalidate the cached answer key.
        setInterval(() => {
            const hash = getHash();
            if (hash === lastHash) return;
            lastHash = hash;
            apiCache = null;
            apiPromise = null;
            apiError = null;
            lastScanKey = '';
            lastScanWidgets = [];
            lastQuestionKey = '';
            answeredKey = '';
            retryCount = 0;
            lastRenderKey = '';
            aiKey = '';
            clearMarks();
            clearOneClick();
            if (hash) scheduleScan(250, { force: true });
        }, 1000);

        let observerTimer = null;
        const observer = new MutationObserver(() => {
            if (observerTimer) return;
            observerTimer = setTimeout(() => {
                observerTimer = null;
                scheduleScan(200);
            }, 100);

            if (window.xdAnswers.helperContainer && !document.body.contains(window.xdAnswers.helperContainer)) {
                document.body.appendChild(window.xdAnswers.helperContainer);
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });

        // Settings changes can turn auto-answer/highlight/silent mode on or off.
        try {
            chrome.storage.onChanged.addListener((changes, area) => {
                if (area !== 'local' || !changes.xdAnswers_settings) return;
                lastScanKey = '';
                answeredKey = '';
                window.xdAnswers.loadSettings()
                    .then(() => scheduleScan(120, { force: false }))
                    .catch(() => scheduleScan(120, { force: false }));
            });
        } catch (e) {}

        scheduleScan(0);
    }
})();
