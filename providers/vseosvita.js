(function() {
    'use strict';

    // ── Topic extraction ────────────────────────────────────────────────
    // vseosvita ships the test title inside the JSON returned from its own POST
    // endpoints /ext/test-designer/testing-pupil/active-screen-data and
    // /start-execution. We patch window.fetch so we can sniff these responses
    // and cache data.testing_title (+ optional data.description_start).
    let _vseosvitaTopic = null;       // string | null
    let _vseosvitaDescription = null; // string | null (HTML stripped)

    function stripHtml(html) {
        try {
            if (!html || typeof html !== 'string') return '';
            const tmp = document.createElement('div');
            tmp.innerHTML = html;
            return (tmp.textContent || tmp.innerText || '').replace(/\s+/g, ' ').trim();
        } catch (e) { return ''; }
    }

    function extractTopicFromVseosvitaPayload(payload) {
        try {
            if (!payload || typeof payload !== 'object') return;
            const data = payload.data;
            if (!data || typeof data !== 'object') return;
            if (typeof data.testing_title === 'string' && data.testing_title.trim()) {
                _vseosvitaTopic = data.testing_title.trim();
                console.log('[xdAnswers/vseosvita] Topic extracted:', _vseosvitaTopic);
            }
            if (typeof data.description_start === 'string' && data.description_start.trim()) {
                const plain = stripHtml(data.description_start);
                if (plain) {
                    _vseosvitaDescription = plain;
                    console.log('[xdAnswers/vseosvita] Description:', plain.slice(0, 80) + (plain.length > 80 ? '...' : ''));
                }
            }
        } catch (e) { console.warn('[xdAnswers/vseosvita] extractTopicFromVseosvitaPayload error:', e); }
    }

    try {
        const origFetch = window.fetch;
        if (origFetch && !window.__xdAnswersVseosvitaFetchHooked) {
            window.__xdAnswersVseosvitaFetchHooked = true;
            window.fetch = function(input, init) {
                const url = (typeof input === 'string') ? input : (input && input.url) || '';
                const promise = origFetch.apply(this, arguments);
                if (url && /\/ext\/test-designer\/testing-pupil\/(active-screen-data|start-execution)/.test(url)) {
                    console.log('[xdAnswers/vseosvita] Fetch intercepted:', url);
                    promise.then(resp => {
                        try {
                            resp.clone().json().then(json => {
                                extractTopicFromVseosvitaPayload(json);
                            }).catch(() => {});
                        } catch (e) {}
                    }).catch(() => {});
                }
                return promise;
            };
        }
    } catch (e) { /* fetch patch failed — topic will simply be missing */ }

    // ── Intercept XMLHttpRequest (some frameworks use XHR instead of fetch) ──
    try {
        const origOpen = XMLHttpRequest.prototype.open;
        const origSend = XMLHttpRequest.prototype.send;
        if (!window.__xdAnswersVseosvitaXHRHooked) {
            window.__xdAnswersVseosvitaXHRHooked = true;
            XMLHttpRequest.prototype.open = function(method, url) {
                this.__xdUrl = url;
                return origOpen.apply(this, arguments);
            };
            XMLHttpRequest.prototype.send = function() {
                if (this.__xdUrl && /\/ext\/test-designer\/testing-pupil\/(active-screen-data|start-execution)/.test(this.__xdUrl)) {
                    console.log('[xdAnswers/vseosvita] XHR intercepted:', this.__xdUrl);
                    this.addEventListener('load', function() {
                        try {
                            const json = JSON.parse(this.responseText);
                            extractTopicFromVseosvitaPayload(json);
                        } catch (e) {}
                    });
                }
                return origSend.apply(this, arguments);
            };
        }
    } catch (e) { /* XHR patch failed */ }

    const waitForUtils = setInterval(async () => {
        if (window.xdAnswers && window.xdAnswers.loadSettings) {
            clearInterval(waitForUtils);
            await window.xdAnswers.loadSettings();
            initVseosvita();
        }
    }, 50);

    function initVseosvita() {
        let lastProcessedKey = "";
        let debounceTimer = null;

        window.xdAnswers.onRefresh = () => {
            lastProcessedKey = "";
            checkQuestion(true);
        };

        function getText(el) {
            return (el?.innerText || el?.textContent || '').replace(/\s+/g, ' ').trim();
        }

        function collectMatchingOptions(questionRoot) {
            const wrapper = questionRoot.querySelector('.v-block-answers-cross-wrapper');
            if (!wrapper) return [];

            const items = [];
            const seen = new Set();

            wrapper.querySelectorAll('.v-block-answers-cross-block').forEach(block => {
                const key = getText(block.querySelector('.numb-item'));
                const value = getText(block.querySelector('.n-kahoot-p, p'));
                const combined = key && value ? `${key}. ${value}` : value || key;
                if (!combined || seen.has(combined)) return;
                seen.add(combined);
                items.push({ key, combined });
            });

            const numericItems = items
                .filter(item => /^\d+$/.test(item.key))
                .sort((a, b) => Number(a.key) - Number(b.key))
                .map(item => item.combined);

            const alphaItems = items
                .filter(item => item.key && !/^\d+$/.test(item.key))
                .sort((a, b) => a.key.localeCompare(b.key, 'uk'))
                .map(item => item.combined);

            const otherItems = items
                .filter(item => !item.key)
                .map(item => item.combined)
                .sort((a, b) => a.localeCompare(b, 'uk'));

            return [...numericItems, ...alphaItems, ...otherItems];
        }

        function collectOptions(questionRoot) {
            const matchingOptions = collectMatchingOptions(questionRoot);
            if (matchingOptions.length) return matchingOptions;

            const optionSelectors = [
                '.answer-text',
                '.v-test-questions-select-block .t-text-guest',
                '.v-test-questions-select-block .t-text',
                '.t-test-questions .t-text-guest',
                '.t-test-questions .t-text',
                '.test-answer',
                'label[for]'
            ];

            const seen = new Set();
            const options = [];
            for (const selector of optionSelectors) {
                questionRoot.querySelectorAll(selector).forEach(el => {
                    const text = getText(el);
                    if (!text) return;
                    if (seen.has(text)) return;
                    seen.add(text);
                    options.push(text);
                });
            }

            if (options.length === 0) {
                const choiceBlocks = questionRoot.querySelectorAll('input[type="radio"], input[type="checkbox"]');
                choiceBlocks.forEach(input => {
                    const wrap = input.closest('label, .answer-item, .v-test-questions-select-block, .test-answer') || input.parentElement;
                    const text = getText(wrap).replace(/^[A-ZА-ЯІЇЄҐ]\s*[\)\.]\s*/i, '').trim();
                    if (text && !seen.has(text)) {
                        seen.add(text);
                        options.push(text);
                    }
                });
            }

            return options;
        }

        // Mark option elements with data-xd-option so findOptionElements()/matchAnswerToOptions()
        // in utils.js can find them for auto-answer and indicator modes
        function markOptionElements(questionRoot) {
            // For radio/checkbox questions: mark the label[for] elements
            questionRoot.querySelectorAll('.v-test-questions-radio-block label[for], .v-test-questions-checkbox-block label[for]').forEach(label => {
                label.setAttribute('data-xd-option', 'true');
            });
            // For matching questions: mark cross-block items
            questionRoot.querySelectorAll('.v-block-answers-cross-block').forEach(block => {
                const textEl = block.querySelector('.n-kahoot-p, p') || block;
                textEl.setAttribute('data-xd-option', 'true');
            });
            // Fallback: mark generic option elements
            questionRoot.querySelectorAll('.v-test-questions-select-block .t-text, .v-test-questions-select-block .t-text-guest, .answer-text, .test-answer').forEach(el => {
                el.setAttribute('data-xd-option', 'true');
            });
            // NEW: premium format interactive elements (types 12, 13)
            // type 12 - true/false buttons
            questionRoot.querySelectorAll('button.item-true-false').forEach(btn => {
                btn.setAttribute('data-xd-option', 'true');
            });
            // type 13 - order-words clickable tokens
            questionRoot.querySelectorAll('.word-queue-test_question_sentence-item').forEach(token => {
                token.setAttribute('data-xd-option', 'true');
            });
        }

        // ── Premium format support (dispatched by data-quest_type attribute) ──
        // These handlers cover vseosvita premium question formats that the legacy
        // CSS-heuristic branch above doesn't recognise. They kick in ONLY when
        // the heuristic branch returns questionType='unknown'.

        // Find the .vr-quest wrapper carrying data-quest_type, starting from questionRoot.
        function findVrQuest(questionRoot) {
            if (!questionRoot) return null;
            return questionRoot.closest?.('.vr-quest[data-quest_type]')
                || questionRoot.querySelector?.('.vr-quest[data-quest_type]')
                || null;
        }

        // Format normalisation: vseosvita uses a mix of non-breaking spaces and odd whitespace.
        function normalize(text) {
            return (text || '').replace(/[\u00A0\u200B\u200C\u200D\uFEFF]/g, ' ').replace(/\s+/g, ' ').trim();
        }

        // ── Type 12: true/false ────────────────────────────────────────────
        function collectTrueFalse(vrQuest) {
            const buttons = Array.from(vrQuest.querySelectorAll('.true-false_test-wrap button.item-true-false'));
            if (buttons.length < 2) return null;
            const items = buttons.map(btn => ({
                text: normalize(btn.textContent) || (btn.classList.contains('green') ? 'Правда' : 'Неправда'),
                element: btn
            }));
            return { formatType: 'true_false', buttons: items };
        }

        // ── Type 3: single text input ──────────────────────────────────────
        // ── Type 5: multi text input ───────────────────────────────────────
        function collectTextInputs(vrQuest) {
            // Prefer labels because they carry the field ordering semantic ("Відповідь 1:", ...)
            const inputs = [];
            vrQuest.querySelectorAll('label').forEach(label => {
                const input = label.querySelector('input[type="text"]');
                if (input) {
                    const labelText = normalize(label.childNodes[0]?.textContent) || normalize(label.textContent).split(':')[0];
                    inputs.push({ label: labelText || `Поле ${inputs.length + 1}`, element: input });
                }
            });
            // Fallback: any text input directly inside the quest
            if (inputs.length === 0) {
                vrQuest.querySelectorAll('input[type="text"]').forEach((input, idx) => {
                    inputs.push({ label: `Поле ${idx + 1}`, element: input });
                });
            }
            if (inputs.length === 0) return null;
            return {
                formatType: inputs.length > 1 ? 'text_input_multi' : 'text_input_single',
                inputs
            };
        }

        // ── Type 6: fill-in-blank (inline contenteditable spans) ───────────
        function collectFillBlanks(vrQuest) {
            const spans = Array.from(vrQuest.querySelectorAll('span.vr-fill-the-gap.vr-control[data-key]'));
            if (spans.length === 0) return null;
            const blanks = spans.map(span => ({
                key: span.getAttribute('data-key') || '',
                element: span
            })).filter(b => b.key);
            if (blanks.length === 0) return null;
            return { formatType: 'fill_blank', blanks };
        }

        // ── Type 7: select-in-text (inline dropdown) ───────────────────────
        // Each blank has a sibling <span>[<strong>opt1, opt2, opt3</strong>]</span>
        // We extract the options list from the sibling so the AI knows what to pick.
        function collectSelectInText(vrQuest) {
            const spans = Array.from(vrQuest.querySelectorAll('span.vr-fill-the-gap-select.vr-control[data-key]'));
            if (spans.length === 0) return null;
            const blanks = spans.map(span => {
                const key = span.getAttribute('data-key') || '';
                // Look for the options listed in the sibling/next element
                let options = [];
                let sibling = span.nextElementSibling;
                // Walk a few siblings forward to find the options span with <strong>
                for (let i = 0; i < 3 && sibling; i++) {
                    const strong = sibling.querySelector?.('strong');
                    if (strong) {
                        options = normalize(strong.textContent).split(',').map(s => s.trim()).filter(Boolean);
                        break;
                    }
                    sibling = sibling.nextElementSibling;
                }
                return { key, options, element: span };
            }).filter(b => b.key);
            if (blanks.length === 0) return null;
            return { formatType: 'select_in_text', blanks };
        }

        // ── Type 8 extras: ordering with <select> dropdowns ────────────────
        // (Already detected by legacy branch as 'ordering', but that branch doesn't
        // support the select-based variant. Kept here as a fallback if the legacy
        // branch ever returns 'unknown' for this DOM shape.)
        function collectOrderingSelect(vrQuest) {
            const blocks = Array.from(vrQuest.querySelectorAll('.v-test-questions-select-block'));
            if (blocks.length === 0) return null;
            const items = blocks.map((block, idx) => {
                const select = block.querySelector('select');
                const textEl = block.querySelector('.t-text-guest, .t-text');
                return {
                    index: idx + 1,
                    text: normalize(textEl?.textContent) || '',
                    element: select || block
                };
            }).filter(i => i.text);
            if (items.length === 0) return null;
            return { formatType: 'ordering_select', items };
        }

        // ── Type 13: order-words (click tokens in order) ───────────────────
        function collectOrderWords(vrQuest) {
            const tokens = Array.from(vrQuest.querySelectorAll('.word-queue-test_question_sentence-wrap-testing .word-queue-test_question_sentence-item'));
            if (tokens.length < 2) return null;
            const items = tokens.map(t => ({ text: normalize(t.textContent), element: t })).filter(t => t.text);
            if (items.length < 2) return null;
            return { formatType: 'order_words', tokens: items };
        }

        // ── Type 18: free-response (essay / textarea) ──────────────────────
        function collectFreeResponse(vrQuest) {
            const textarea = vrQuest.querySelector('textarea') || vrQuest.querySelector('[contenteditable="true"]');
            // Static dumps may have no textarea (preview mode) — still classify the type
            // so the AI prompt triggers and autoSelectAnswer's fallback branch can fill
            // the textarea that vseosvita renders at runtime.
            return { formatType: 'free_response', element: textarea || null };
        }

        // Dispatch by data-quest_type; returns { formatType, ...meta } or null.
        function detectPremiumFormat(questionRoot) {
            const vrQuest = findVrQuest(questionRoot);
            if (!vrQuest) return null;
            const dqt = vrQuest.getAttribute('data-quest_type');
            if (!dqt) return null;

            let meta = null;
            switch (dqt) {
                case '3':  meta = collectTextInputs(vrQuest); break;    // single input
                case '5':  meta = collectTextInputs(vrQuest); break;    // multi input (same collector, distinguishes by count)
                case '6':  meta = collectFillBlanks(vrQuest); break;
                case '7':  meta = collectSelectInText(vrQuest); break;
                case '8':  meta = collectOrderingSelect(vrQuest); break; // fallback only - legacy branch usually catches this
                case '12': meta = collectTrueFalse(vrQuest); break;
                case '13': meta = collectOrderWords(vrQuest); break;
                case '18': meta = collectFreeResponse(vrQuest); break;
                default:
                    return null; // unsupported premium type (drag/canvas/slider/image-hotspot)
            }
            if (!meta) return null;
            meta.vrQuest = vrQuest;
            meta.dataQuestType = dqt;
            return meta;
        }

        // Build the AI-side optionsText for formats that expose choices.
        function premiumOptionsText(meta) {
            if (!meta) return undefined;
            if (meta.formatType === 'true_false') {
                return meta.buttons.map((b, i) => `${String.fromCharCode(65 + i)}: ${b.text}`).join('\n');
            }
            if (meta.formatType === 'order_words') {
                return meta.tokens.map(t => `- ${t.text}`).join('\n');
            }
            if (meta.formatType === 'text_input_multi') {
                return meta.inputs.map(i => `- ${i.label}`).join('\n');
            }
            if (meta.formatType === 'fill_blank') {
                return meta.blanks.map(b => `- Пропуск ${b.key}`).join('\n');
            }
            if (meta.formatType === 'select_in_text') {
                return meta.blanks
                    .map(b => `- ${b.key}: [${b.options.join(' | ')}]`)
                    .join('\n');
            }
            if (meta.formatType === 'ordering_select') {
                return meta.items.map(i => `- ${i.text}`).join('\n');
            }
            return undefined;
        }

        // Map premium formatType to the existing questionType vocabulary that
        // src/ai/request.js understands (plus new ones we're adding).
        function premiumQuestionType(formatType) {
            switch (formatType) {
                case 'true_false':       return 'true_false';
                case 'text_input_single':return 'short_text';
                case 'text_input_multi': return 'text_input_multi';
                case 'fill_blank':       return 'fill_blank';
                case 'select_in_text':   return 'select_in_text';
                case 'order_words':      return 'order_words';
                case 'ordering_select':  return 'ordering';
                case 'free_response':    return 'paragraph';
                default:                 return 'unknown';
            }
        }

        // ── Appliers: execute AI answer against the DOM ───────────────────
        // Each applier receives the parsed AI answer string and the meta captured
        // at detection time. They're wired into window.xdAnswers._customAutoAnswer
        // only for formats that need custom click/fill logic; simple text-fill
        // (single input, textarea) falls back to the default autoSelectAnswer.

        // Parse "A0=value; A1=value2" into a Map { 'A0' -> 'value', 'A1' -> 'value2' }
        function parseKeyedAnswer(answerText) {
            const out = new Map();
            if (!answerText) return out;
            const parts = answerText.split(/[;\n]/).map(s => s.trim()).filter(Boolean);
            for (const part of parts) {
                const m = part.match(/^([A-Za-z]\d+)\s*[=:\-\u2013\u2014]\s*(.+)$/);
                if (m) {
                    out.set(m[1].toUpperCase(), m[2].trim());
                }
            }
            return out;
        }

        // Set a text value using the native setter (so Vue/React pick up the change).
        function setNativeValue(el, value) {
            const proto = el instanceof HTMLTextAreaElement
                ? window.HTMLTextAreaElement.prototype
                : (el instanceof HTMLSelectElement ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype);
            const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
            if (setter) setter.call(el, value);
            else el.value = value;
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
        }

        function applyTrueFalse(meta, answerText) {
            const norm = normalize(answerText).toLowerCase();
            // Map Ukrainian/English true-false synonyms to the button classes.
            const truthy = /(^|\s)(правда|так|вірно|істина|true|yes)(\s|$)/;
            const falsy = /(^|\s)(неправда|ні|невірно|хибно|хиба|хибне|false|no)(\s|$)/;
            let target = null;
            if (truthy.test(norm)) target = meta.buttons.find(b => b.element.classList.contains('green'))?.element;
            else if (falsy.test(norm)) target = meta.buttons.find(b => b.element.classList.contains('red'))?.element;
            // Fallback: fuzzy text match
            if (!target) {
                const best = meta.buttons.find(b => normalize(b.text).toLowerCase() === norm);
                target = best?.element;
            }
            if (target) {
                target.click();
                target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
                target.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
            }
        }

        function applyTextInputSingle(meta, answerText) {
            const input = meta.inputs[0]?.element;
            if (input) setNativeValue(input, answerText);
        }

        function applyTextInputMulti(meta, answerText) {
            // Expect "answer1; answer2; answer3" in provider-order.
            const parts = answerText.split(/;\s*|\n/).map(s => s.trim()).filter(Boolean);
            meta.inputs.forEach((field, idx) => {
                const val = parts[idx];
                if (val != null && field.element) setNativeValue(field.element, val);
            });
        }

        function applyFillBlanks(meta, answerText) {
            const map = parseKeyedAnswer(answerText);
            meta.blanks.forEach(blank => {
                const val = map.get(blank.key.toUpperCase());
                if (val == null) return;
                try {
                    // At runtime vseosvita injects an <input type="text"> inside
                    // the .vr-fill-the-gap span (same data-key). Prefer that.
                    // Fallback to contenteditable span (which is what static
                    // preview dumps ship before runtime hydration).
                    const input = blank.element.querySelector('input[type="text"]');
                    if (input) {
                        setNativeValue(input, val);
                        input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
                    } else {
                        blank.element.setAttribute('contenteditable', 'true');
                        blank.element.textContent = val;
                        blank.element.dispatchEvent(new Event('input', { bubbles: true }));
                        blank.element.dispatchEvent(new Event('change', { bubbles: true }));
                        blank.element.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
                    }
                } catch (e) {
                    console.warn('[xdAnswers/vseosvita] fill_blank apply failed:', e);
                }
            });
        }

        function applySelectInText(meta, answerText) {
            // Runtime DOM for type 7 is not fully known from static dumps; best-effort:
            // - Set textContent on the span (visual);
            // - Click the span to open a dropdown (if vseosvita attaches one);
            // - Dispatch input events in case it's contenteditable-backed.
            // NOTE: may need refinement once observed on live vseosvita runtime.
            const map = parseKeyedAnswer(answerText);
            meta.blanks.forEach(blank => {
                const val = map.get(blank.key.toUpperCase());
                if (val == null) return;
                try {
                    blank.element.setAttribute('contenteditable', 'true');
                    blank.element.textContent = val;
                    blank.element.dispatchEvent(new Event('input', { bubbles: true }));
                    blank.element.dispatchEvent(new Event('change', { bubbles: true }));
                } catch (e) {
                    console.warn('[xdAnswers/vseosvita] select_in_text apply failed:', e);
                }
            });
        }

        function applyOrderWords(meta, answerText) {
            // AI returns words separated by "; " in the desired order.
            // Click tokens sequentially; vseosvita moves each clicked token to the answer area.
            const wanted = answerText.split(/;\s*|\n/).map(s => normalize(s).toLowerCase()).filter(Boolean);
            const remaining = meta.tokens.slice();
            for (const w of wanted) {
                // Find closest matching token (Levenshtein-like: prefer exact, then substring).
                let hitIdx = remaining.findIndex(t => normalize(t.text).toLowerCase() === w);
                if (hitIdx < 0) {
                    hitIdx = remaining.findIndex(t => normalize(t.text).toLowerCase().includes(w) || w.includes(normalize(t.text).toLowerCase()));
                }
                if (hitIdx < 0) continue;
                const token = remaining.splice(hitIdx, 1)[0];
                if (token?.element) {
                    token.element.click();
                    token.element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
                    token.element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
                }
            }
        }

        function applyFreeResponse(meta, answerText) {
            // Use the element captured at detection time if present, otherwise
            // search the latest DOM (vseosvita renders the textarea lazily for type 18).
            let target = meta.element;
            if (!target && meta.vrQuest) {
                target = meta.vrQuest.querySelector('textarea') || meta.vrQuest.querySelector('[contenteditable="true"]');
            }
            if (!target) return;
            if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') {
                setNativeValue(target, answerText);
            } else {
                // contenteditable
                target.textContent = answerText;
                target.dispatchEvent(new Event('input', { bubbles: true }));
                target.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }

        function applyOrderingSelect(meta, answerText) {
            // AI returns items separated by "; " in correct order.
            // For each listed item, find matching block and set its <select> to the
            // position number (1-based).
            const wanted = answerText.split(/;\s*|\n/).map(s => normalize(s).toLowerCase()).filter(Boolean);
            wanted.forEach((want, positionIdx) => {
                const hit = meta.items.find(it => {
                    const t = normalize(it.text).toLowerCase();
                    return t === want || t.includes(want) || want.includes(t);
                });
                if (hit && hit.element && hit.element.tagName === 'SELECT') {
                    setNativeValue(hit.element, String(positionIdx + 1));
                }
            });
        }

        // Central applier dispatcher used as window.xdAnswers._customAutoAnswer.
        function makeCustomApplier(meta) {
            return function(answerText /*, parsed */) {
                if (!answerText || !meta) return;
                try {
                    switch (meta.formatType) {
                        case 'true_false':       applyTrueFalse(meta, answerText); break;
                        case 'text_input_single':applyTextInputSingle(meta, answerText); break;
                        case 'text_input_multi': applyTextInputMulti(meta, answerText); break;
                        case 'fill_blank':       applyFillBlanks(meta, answerText); break;
                        case 'select_in_text':   applySelectInText(meta, answerText); break;
                        case 'order_words':      applyOrderWords(meta, answerText); break;
                        case 'ordering_select':  applyOrderingSelect(meta, answerText); break;
                        case 'free_response':    applyFreeResponse(meta, answerText); break;
                    }
                } catch (e) {
                    console.warn('[xdAnswers/vseosvita] customApplier error:', e);
                }
            };
        }

        // Formats that need a CUSTOM applier (anything other than simple click-a-label
        // or fill-single-textbox, which the default autoSelectAnswer already covers).
        const CUSTOM_APPLIER_FORMATS = new Set([
            'true_false',           // button click (green/red classes) - custom for class-based TRUE/FALSE mapping
            'text_input_multi',     // multiple fields, parse "; "-separated
            'fill_blank',           // contenteditable spans OR inner input[type=text], parse "A0=val"
            'select_in_text',       // contenteditable + runtime dropdown (best-effort)
            'ordering_select'       // set <select> values by position
        ]);
        // order_words relies on default autoSelectAnswer (the "; "-split + fuzzy
        // match naturally clicks tokens in answer order).
        // text_input_single and free_response rely on default autoSelectAnswer
        // fallback (it already handles `input[type="text"]` and `textarea`).
        // true_false COULD fall back to default click since both buttons are now
        // data-xd-option tagged, but we keep a custom applier so TRUE/FALSE map
        // unambiguously to the .green/.red button class regardless of button text.


        function detectQuestionData() {
            const questionRoot = document.querySelector('#i-test-question-uwj219, .v-test-question, .v-test-go-bg, .test-question-text, .vseosvita-test-content');
            if (!questionRoot) return null;

            const titleNode = questionRoot.querySelector('.v-test-questions-title .content-box, .v-test-questions-title, .test-question-text, .question-text');
            const text = getText(titleNode || questionRoot);
            if (!text) return null;

            // Mark option elements for auto-answer/indicators
            markOptionElements(questionRoot);

            const options = collectOptions(questionRoot);

            // Collect images from question title first, then from the rest of the question
            const titleImgs = Array.from(
                (titleNode || questionRoot).querySelectorAll('img')
            ).map(img => img.src || img.getAttribute('data-src')).filter(Boolean);
            const otherImgs = Array.from(
                questionRoot.querySelectorAll('img')
            ).map(img => img.src || img.getAttribute('data-src')).filter(Boolean);
            const imgs = [...new Set([...titleImgs, ...otherImgs])];

            // Detect question type
            const hasTextInput = questionRoot.querySelector('.a-test-lab-inp input[type="text"]') !== null;
            const hasCheckbox = questionRoot.querySelector('input[type="checkbox"]') !== null;
            const hasRadio = questionRoot.querySelector('input[type="radio"]') !== null;
            const hasMatching = questionRoot.querySelector('.matching-question, .matching-block, .v-block-answers-cross-wrapper') !== null;
            const hasOrdering = questionRoot.querySelector('.row_draggable-question, .draggable-question-box') !== null;

            let questionType = 'unknown';
            let isMultiQuiz = false;

            if (hasOrdering) {
                questionType = 'ordering';
            } else if (hasMatching) {
                questionType = 'matching';
            } else if (hasTextInput) {
                questionType = 'short_text';
            } else if (hasCheckbox) {
                questionType = 'quiz';
                isMultiQuiz = true;
            } else if (hasRadio) {
                questionType = 'quiz';
            }

            // NEW: premium format detection via data-quest_type attribute.
            // Only runs when legacy CSS heuristics didn't recognise the format —
            // so existing working types (quiz/multiquiz/matching/ordering/short_text)
            // are not affected.
            let vseosvitaMeta = null;
            if (questionType === 'unknown') {
                vseosvitaMeta = detectPremiumFormat(questionRoot);
                if (vseosvitaMeta) {
                    questionType = premiumQuestionType(vseosvitaMeta.formatType);
                }
            } else if (questionType === 'short_text') {
                // Upgrade path: legacy branch classifies type 5 (multi-input) as
                // short_text because it sees `a-test-lab-inp` + input[type=text].
                // If data-quest_type="5" we override to text_input_multi so the
                // multi-field applier runs. Does NOT affect genuine type 3 /
                // short_text — those stay on the legacy path.
                const vq = findVrQuest(questionRoot);
                if (vq && vq.getAttribute('data-quest_type') === '5') {
                    const meta = collectTextInputs(vq);
                    if (meta && meta.formatType === 'text_input_multi') {
                        vseosvitaMeta = meta;
                        vseosvitaMeta.vrQuest = vq;
                        vseosvitaMeta.dataQuestType = '5';
                        questionType = 'text_input_multi';
                    }
                }
            }

            // Merge premium optionsText into the options list when no legacy options were found.
            let premiumOpts;
            if (vseosvitaMeta && !options.length) {
                premiumOpts = premiumOptionsText(vseosvitaMeta);
            }

            return {
                root: questionRoot,
                text,
                options,
                optionsText: options.join('\n') || premiumOpts || undefined,
                base64ImageSources: imgs,
                questionType,
                isMultiQuiz,
                isMulti: isMultiQuiz,
                vseosvitaMeta
            };
        }

        // Wire a custom applier for premium formats that need it.
        // Runs right before processQuestion() / oneclick-handler-triggered processQuestion.
        function installCustomApplier(meta) {
            if (meta && CUSTOM_APPLIER_FORMATS.has(meta.formatType)) {
                window.xdAnswers._customAutoAnswer = makeCustomApplier(meta);
            }
        }

        function checkQuestion(force = false) {
            if (window.xdAnswers.isProcessingAI && !force) return;
            const questionData = detectQuestionData();
            if (!questionData) return;

            const keyOptions = ['ordering', 'matching'].includes(questionData.questionType)
                ? [...questionData.options].sort((a, b) => a.localeCompare(b, 'uk'))
                : questionData.options;

            const currentKey = JSON.stringify({
                text: questionData.text,
                options: keyOptions,
                type: questionData.questionType,
                images: questionData.base64ImageSources,
                // Include premium format signature so question-change detection fires
                // when the same wrapper hosts a different premium question.
                premium: questionData.vseosvitaMeta
                    ? questionData.vseosvitaMeta.formatType + ':' + (questionData.vseosvitaMeta.dataQuestType || '')
                    : null
            });

            if (!force && currentKey === lastProcessedKey) return;
            lastProcessedKey = currentKey;

            const isOneClick = window.xdAnswers.settings.silentMode === 'oneclick';

            if (isOneClick) {
                // One-click mode: register click handler instead of auto-processing
                // Vseosvita reuses the same container DOM element for each question,
                // so we must always re-register when the question key changes
                const container = questionData.root;
                if (container) {
                    window.xdAnswers.clearOneClickHandlers();
                    // Capture current question data for click-time processing
                    const savedText = questionData.text;
                    const savedOptionsText = questionData.optionsText;
                    const savedImageUrls = questionData.base64ImageSources;
                    const savedQuestionType = questionData.questionType;
                    const savedIsMultiQuiz = questionData.isMultiQuiz;
                    const savedIsMulti = questionData.isMulti;
                    const savedMeta = questionData.vseosvitaMeta;
                    window.xdAnswers.setupOneClickHandler(container, async () => {
                        // Re-mark options in case DOM changed since last detection
                        markOptionElements(container);
                        // Install custom applier ONLY at click time so it's fresh
                        // and doesn't leak across questions.
                        installCustomApplier(savedMeta);
                        const images = await Promise.all(savedImageUrls.map(src => window.xdAnswers.imageToBase64(src)));
                        return {
                            text: savedText,
                            optionsText: savedOptionsText,
                            base64Images: images.filter(Boolean),
                            questionType: savedQuestionType,
                            isMultiQuiz: savedIsMultiQuiz,
                            isMulti: savedIsMulti,
                            topic: _vseosvitaTopic || undefined,
                            topicDescription: _vseosvitaDescription || undefined
                        };
                    });
                }
                window.xdAnswers.attachAndPositionHelper();
            } else {
                // Normal: auto-process
                // Install custom applier right before processQuestion consumes it.
                installCustomApplier(questionData.vseosvitaMeta);
                const imgPromises = questionData.base64ImageSources.map(src => window.xdAnswers.imageToBase64(src));
                Promise.all(imgPromises).then(images => {
                    window.xdAnswers.processQuestion({
                        text: questionData.text,
                        optionsText: questionData.optionsText,
                        base64Images: images.filter(Boolean),
                        questionType: questionData.questionType,
                        isMultiQuiz: questionData.isMultiQuiz,
                        isMulti: questionData.isMulti,
                        topic: _vseosvitaTopic || undefined,
                        topicDescription: _vseosvitaDescription || undefined
                    });
                    window.xdAnswers.attachAndPositionHelper();
                });
            }
        }

        const observer = new MutationObserver(() => {
            if (window.xdAnswers.isExtensionModifyingDOM) return;
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => checkQuestion(false), 250);
            // Only re-attach if container was removed from DOM (e.g. Vue re-render);
            // do NOT call attachAndPositionHelper unconditionally — it clears transform
            // and resets position, which breaks dragging during AI processing.
            if (window.xdAnswers.helperContainer && !window.xdAnswers.helperContainer.parentNode) {
                window.xdAnswers.attachAndPositionHelper();
            }
        });

        observer.observe(document.body, { childList: true, subtree: true, characterData: true });
        checkQuestion();

        // Polling fallback: vseosvita reuses the same container DOM element (Vue),
        // so MutationObserver may miss subtle question transitions.
        // This ensures new questions are detected within 1 second max.
        setInterval(() => checkQuestion(false), 1000);
    }
})();
