// xdAnswers provider — НаУрок олімпіади / конкурси (naurok.ua/round/*)
(function () {
    'use strict';

    const HL_CLASS = 'xd-highlight-correct';
    const LETTERS = 'ABCDEFGHIJ';

    const waitForUtils = setInterval(async () => {
        if (window.xdAnswers && window.xdAnswers.loadSettings) {
            clearInterval(waitForUtils);
            await window.xdAnswers.loadSettings();
            initNaurokRound();
        }
    }, 50);

    function I() { return window.xdAnswers._internal; }

    function norm(s) {
        return String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
    }

    function cleanRef(text) {
        return norm(String(text || '').replace(/[*_`]/g, '').replace(/^["'«„“]+|["'»“”]+$/g, ''));
    }

    function toAbsolute(src) {
        try { return new URL(src, window.location.href).href; } catch (e) { return src; }
    }

    function annotationOf(el) {
        return el && el.querySelector ? el.querySelector('annotation[encoding="application/x-tex"]') : null;
    }

    function katexText(el) {
        const tex = annotationOf(el);
        return tex ? '$' + norm(tex.textContent) + '$' : '';
    }

    function optionText(el) {
        const k = katexText(el);
        // Mixed content like "$Cu(OH)_2$ та SO_2": keep both the TeX parts and the
        // plain text around them (textContent would duplicate KaTeX internals).
        if (k || (el.classList && el.classList.contains('katex'))) {
            return richText(el, { images: [], inputs: [] });
        }
        return norm(el.textContent);
    }

    // Renders a subtree into plain text: KaTeX becomes $tex$, images become [зображення],
    // inputs become [A0]/[A1]/... (registered in ctx.inputs in DOM order).
    function richText(root, ctx) {
        const parts = [];
        const visit = (node) => {
            if (node.nodeType === 3) {
                const t = norm(node.nodeValue);
                if (t) parts.push(t);
                return;
            }
            if (node.nodeType !== 1) return;
            const tag = node.tagName;
            if (tag === 'SELECT' || tag === 'BUTTON') return;
            if (tag === 'KATEX' || (node.classList && node.classList.contains('katex') && annotationOf(node))) {
                parts.push(katexText(node));
                return;
            }
            if (tag === 'IMG') {
                const src = node.getAttribute('src') || node.getAttribute('ng-src') || '';
                const real = src.replace(/\{\{[^}]*\}\}/g, '');
                if (real && !real.startsWith('data:') && ctx) ctx.images.push(toAbsolute(real));
                parts.push('[зображення]');
                return;
            }
            if (tag === 'INPUT') {
                if (ctx) {
                    ctx.inputs.push(node);
                    parts.push('[A' + (ctx.inputs.length - 1) + ']');
                }
                return;
            }
            for (const child of node.childNodes) visit(child);
        };
        visit(root);
        return parts.join(' ');
    }

    function getQuestionNumber() {
        const el = document.querySelector('.task-name');
        const m = norm(el && el.textContent).match(/№\s*(\d+)/);
        return m ? m[1] : '';
    }

    function blockType(block) {
        const m = (block.getAttribute('ng-if') || '').match(/isQuestionType\('([a-z_0-9]+)'\)/);
        return m ? m[1] : '';
    }

    function visibleAnswerBlock(questionEl) {
        const blocks = Array.from(questionEl.querySelectorAll('.sth-question-answers > .answers-list'))
            .filter(b => !b.classList.contains('ng-hide'));
        return blocks[0] || null;
    }

    // ---------------------------------------------------------------------
    // Question extraction
    // ---------------------------------------------------------------------

    function collectMeta(questionEl) {
        const block = visibleAnswerBlock(questionEl);
        if (!block) return null;
        const type = blockType(block);
        if (!type) return null;

        const ctx = { images: [], inputs: [] };
        const contentEl = questionEl.querySelector('.sth-question-content');
        const meta = {
            type: type,
            qNum: getQuestionNumber(),
            questionEl: questionEl,
            block: block,
            images: ctx.images,
            inputs: ctx.inputs,
            options: [],
            rows: [],
            list: null,
            text: contentEl ? richText(contentEl, ctx) : ''
        };

        if (type === 'quiz' || type === 'multiquiz') {
            const sel = type === 'quiz' ? 'span.sth-answer-control-radio' : 'span.sth-answer-control-checkbox';
            meta.options = Array.from(block.querySelectorAll(sel)).map(el => ({ el: el, text: optionText(el) }));
        } else if (type === 'quiz_image' || type === 'multiquiz_image') {
            meta.options = Array.from(block.querySelectorAll('div.sth-answer-control-image-radio > span')).map((el, i) => {
                const img = el.querySelector('img');
                if (img) {
                    const src = img.getAttribute('src') || img.getAttribute('ng-src') || '';
                    const real = src.replace(/\{\{[^}]*\}\}/g, '');
                    if (real && !real.startsWith('data:')) meta.images.push(toAbsolute(real));
                }
                return { el: el, text: 'варіант ' + (LETTERS[i] || String(i + 1)) };
            });
        } else if (type === 'truefalse') {
            meta.rows = Array.from(block.querySelectorAll('.sth-answer-truefalse-row')).map(row => {
                const spans = Array.from(row.querySelectorAll('span.sth-answer-control-radio'));
                const stmt = row.querySelector('div');
                return { el: row, label: stmt ? richText(stmt, ctx) : '', spans: spans };
            });
        } else if (type === 'select') {
            meta.options = Array.from(block.querySelectorAll('li.sth-answer-control-select-option'))
                .map(el => ({ el: el, text: optionText(el) }));
        } else if (type === 'short') {
            const input = block.querySelector('input.sth-answer-control-string');
            if (input) meta.inputs.push(input);
        } else if (type === 'fill') {
            const fillRoot = block.querySelector('div[latex]') || block;
            const fctx = { images: [], inputs: [] };
            meta.text = richText(fillRoot, fctx);
            meta.inputs = fctx.inputs;
            fctx.images.forEach(u => meta.images.push(u));
        } else if (type === 'order' || type === 'order2') {
            const listEl = block.querySelector('ul.sth-answer-control-order');
            if (listEl) {
                meta.list = {
                    el: listEl,
                    items: Array.from(listEl.querySelectorAll('li')).map(el => ({ el: el, text: optionText(el) }))
                };
            }
        } else if (type === 'match' || type === 'match_image') {
            const rowEls = type === 'match_image'
                ? Array.from(block.querySelectorAll('.sth-answer-control-image-insert > div'))
                : Array.from(block.querySelectorAll('.sth-answer-control-insert > .item-row'));
            meta.rows = rowEls.map((rowEl, i) => {
                const labelEl = rowEl.querySelector('.item-row-left') || rowEl.querySelector('.drop-area-block');
                const select = rowEl.querySelector('select');
                return {
                    el: rowEl,
                    num: i + 1,
                    label: labelEl ? richText(labelEl, ctx) : '',
                    select: select,
                    options: select
                        ? Array.from(select.options).filter(o => !o.disabled).map(o => ({ el: o, value: o.value, text: norm(o.textContent) }))
                        : []
                };
            });
        }
        return meta;
    }

    function buildQuestionData(meta, base64Images) {
        const data = {
            text: meta.text || ' ',
            optionsText: undefined,
            base64Images: base64Images,
            questionType: 'quiz',
            isMultiQuiz: false,
            isMulti: false
        };
        const type = meta.type;

        if (type === 'quiz' || type === 'select') {
            data.questionType = 'quiz';
            data.optionsText = meta.options.map(o => o.text).join('\n') || undefined;
        } else if (type === 'quiz_image') {
            data.questionType = 'quiz';
            data.optionsText = meta.options.map((o, i) => (LETTERS[i] || (i + 1)) + ') [зображення]').join('\n') || undefined;
        } else if (type === 'multiquiz') {
            data.questionType = 'multiquiz';
            data.isMultiQuiz = true;
            data.optionsText = meta.options.map(o => o.text).join('\n') || undefined;
        } else if (type === 'multiquiz_image') {
            data.questionType = 'multiquiz';
            data.isMultiQuiz = true;
            data.optionsText = meta.options.map((o, i) => (LETTERS[i] || (i + 1)) + ') [зображення]').join('\n') || undefined;
        } else if (type === 'truefalse') {
            data.questionType = 'true_false_multi';
            data.optionsText = meta.rows.map((r, i) => (i + 1) + '. ' + (r.label || '')).join('\n') || undefined;
        } else if (type === 'short') {
            data.questionType = 'short_text';
        } else if (type === 'fill') {
            data.questionType = 'fill_blank';
        } else if (type === 'order' || type === 'order2') {
            data.questionType = 'order_words';
            data.optionsText = meta.list ? meta.list.items.map(it => it.text).join('\n') : undefined;
        } else if (type === 'match' || type === 'match_image') {
            data.questionType = 'match_pairs';
            const rows = meta.rows.map((r, i) => (i + 1) + '. ' + (r.label || ''));
            const variants = (meta.rows.find(r => r.options.length) || { options: [] }).options.map(o => o.text);
            data.optionsText = 'Рядки:\n' + rows.join('\n') + '\n\nВаріанти:\n' + variants.join('\n');
        }
        return data;
    }

    // ---------------------------------------------------------------------
    // Answer resolution helpers
    // ---------------------------------------------------------------------

    function splitRefs(text) {
        return String(text || '').split(/[;\n]+/).map(s => s.trim()).filter(Boolean);
    }

    function resolveChoice(candidates, ref) {
        const text = cleanRef(ref);
        if (!text) return null;
        let m = text.match(/^(?:варіант|вариант|option|variant)?\s*([a-zа-я])\s*[).:]?\s*$/i);
        if (m) {
            const ch = m[1].toLowerCase();
            let idx = 'abcdefghijklmnopqrstuvwxyz'.indexOf(ch);
            if (idx < 0) idx = 'абвгґдеєжзиіїйклмнопрстуфхцчшщьюя'.indexOf(ch);
            if (idx < 0 && ch === 'с') idx = 2;
            if (idx >= 0 && idx < candidates.length) return candidates[idx];
        }
        m = text.match(/^(\d+)\s*[).]?$/);
        if (m) {
            const i = parseInt(m[1], 10) - 1;
            if (i >= 0 && i < candidates.length) return candidates[i];
        }
        const target = I().normalizeText(text);
        let best = null, bestScore = 0;
        for (const c of candidates) {
            const n = I().normalizeText(c.text);
            if (!n) continue;
            const s = I().textSimilarity(target, n);
            if (s > bestScore) { bestScore = s; best = c; }
        }
        if (best && bestScore >= 0.45) return best;
        for (const c of candidates) {
            const n = I().normalizeText(c.text);
            if (n && target && (n.includes(target) || target.includes(n))) return c;
        }
        return null;
    }

    function parseKeyedPairs(text) {
        const map = new Map();
        for (const part of splitRefs(text)) {
            const m = part.match(/^([A-Za-z]\d+)\s*[=:\-–—]\s*(.+)$/);
            if (m) map.set(m[1].toUpperCase(), m[2].trim());
        }
        return map;
    }

    function setNativeValue(el, value) {
        const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype
            : el.tagName === 'SELECT' ? window.HTMLSelectElement.prototype
            : window.HTMLInputElement.prototype;
        const desc = Object.getOwnPropertyDescriptor(proto, 'value');
        if (desc && desc.set) desc.set.call(el, value); else el.value = value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function simulateClick(el) {
        if (!el) return;
        el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
        el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
        el.click();
    }

    function markEl(el) {
        if (!el || !el.classList) return;
        el.classList.add(HL_CLASS);
        el.style.outline = '3px solid #22c55e';
        el.style.outlineOffset = '2px';
        el.style.background = 'rgba(34, 197, 94, 0.15)';
        el.style.borderRadius = '4px';
    }

    function clearHighlights(questionEl) {
        questionEl.querySelectorAll('.' + HL_CLASS).forEach(el => {
            el.classList.remove(HL_CLASS);
            el.style.outline = '';
            el.style.outlineOffset = '';
            el.style.background = '';
            el.style.borderRadius = '';
        });
    }

    // ---------------------------------------------------------------------
    // Page-world bridge (order/order2 reorder via Angular scope)
    // ---------------------------------------------------------------------

    let msgSeq = 0;
    const pendingMsg = new Map();

    window.addEventListener('message', (e) => {
        const d = e.data;
        if (!d || d.source !== 'xd-naurok-page' || d.cmd !== 'reorder-result') return;
        const cb = pendingMsg.get(d.requestId);
        if (cb) { pendingMsg.delete(d.requestId); cb(d); }
    });

    function requestReorder(order, timeoutMs) {
        return new Promise(resolve => {
            const id = ++msgSeq;
            let done = false;
            pendingMsg.set(id, d => { if (!done) { done = true; resolve(d); } });
            window.postMessage({ source: 'xd-naurok', cmd: 'reorder', requestId: id, order: order }, '*');
            setTimeout(() => {
                if (!done) { done = true; pendingMsg.delete(id); resolve({ ok: false, timeout: true }); }
            }, timeoutMs || 1500);
        });
    }

    function itemKey(el) {
        const tex = annotationOf(el);
        return tex ? norm(tex.textContent) : norm(el.textContent);
    }

    function dragMouse(fromEl, toEl) {
        const a = fromEl.getBoundingClientRect();
        const b = toEl.getBoundingClientRect();
        const startX = a.left + a.width / 2, startY = a.top + a.height / 2;
        const endX = b.left + b.width / 2, endY = b.top + b.height / 2;
        fromEl.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window, clientX: startX, clientY: startY, button: 0 }));
        for (let s = 1; s <= 6; s++) {
            const x = startX + (endX - startX) * s / 6;
            const y = startY + (endY - startY) * s / 6;
            document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y, button: 0 }));
        }
        document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window, clientX: endX, clientY: endY, button: 0 }));
    }

    // Best-effort fallback for ng-sortable lists (forceFallback mouse dragging).
    function sortableFallbackReorder(listEl, orderedItems) {
        const desired = orderedItems.map(it => it.el);
        for (let i = 0; i < desired.length; i++) {
            const current = Array.from(listEl.querySelectorAll('li'))[i];
            const item = desired[i];
            if (!current || !item || item === current) continue;
            dragMouse(item, current);
        }
    }

    // ---------------------------------------------------------------------
    // Answer application
    // ---------------------------------------------------------------------

    function applyChoiceList(meta, answerText, doHighlight, doApply) {
        const used = new Set();
        for (const part of splitRefs(answerText)) {
            const cand = resolveChoice(meta.options.filter(o => !used.has(o)), part);
            if (!cand) continue;
            used.add(cand);
            if (doHighlight) markEl(cand.el);
            if (doApply) simulateClick(cand.el);
        }
    }

    function applyTrueFalse(meta, answerText, doHighlight, doApply) {
        for (const part of splitRefs(answerText)) {
            const m = part.match(/^(\d+)\s*[).\]]*\s*[=:\-–—]?\s*(.+)$/);
            let row = m && m[1] ? meta.rows[parseInt(m[1], 10) - 1] : null;
            let verdict = m ? m[2] : part;
            if (!row) {
                row = meta.rows.find(r => !r._used);
                verdict = part;
            }
            if (!row) break;
            row._used = true;
            const falsy = /(неправда|невірно|хибно|хиба|\bні\b|\bno\b|\bfalse\b)/i.test(verdict);
            const truthy = /(правда|вірно|істина|\bтак\b|\byes\b|\btrue\b)/i.test(verdict);
            const span = falsy ? row.spans[1] : (truthy ? row.spans[0] : null);
            if (doHighlight) markEl(row.el);
            if (doApply && span) simulateClick(span);
        }
    }

    function resolveRow(meta, ref, usedRows) {
        const text = cleanRef(ref);
        let m = text.match(/\[?\s*зображення\s*(\d+)\s*\]?/i);
        if (m) return meta.rows[parseInt(m[1], 10) - 1] || null;
        m = text.match(/^(?:рядок\s*)?(\d+)\s*[).]?$/i);
        if (m && meta.rows[parseInt(m[1], 10) - 1]) return meta.rows[parseInt(m[1], 10) - 1];
        let best = null, bestScore = 0;
        for (const r of meta.rows) {
            if (usedRows.has(r)) continue;
            const n = I().normalizeText(r.label);
            if (!n) continue;
            const s = I().textSimilarity(I().normalizeText(text), n);
            if (s > bestScore) { bestScore = s; best = r; }
        }
        if (best && bestScore >= 0.45) return best;
        for (const r of meta.rows) {
            if (usedRows.has(r)) continue;
            const n = I().normalizeText(r.label);
            if (n && I().normalizeText(text).includes(n)) return r;
        }
        return null;
    }

    function applyRowVariant(row, variantRef, doHighlight, doApply) {
        if (doHighlight) markEl(row.el);
        if (!doApply || !row.select || row._applied) return;
        const cand = resolveChoice(row.options.map(o => ({ el: o.el, text: o.text, value: o.value })), variantRef);
        if (!cand) return;
        row._applied = true;
        row.select.value = cand.value;
        row.select.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function applyMatch(meta, answerText, doHighlight, doApply) {
        const usedRows = new Set();
        const leftovers = [];
        for (const part of splitRefs(answerText)) {
            const m = part.match(/^(.+?)\s*(?:=|:|->|→|–|—)\s*(.+)$/);
            const row = m ? resolveRow(meta, m[1], usedRows) : null;
            if (!row) { leftovers.push(part); continue; }
            usedRows.add(row);
            applyRowVariant(row, m[2], doHighlight, doApply);
        }
        // AI listed only variants, one per row: assign in order to the next rows
        for (const ref of leftovers) {
            const row = meta.rows.find(r => !usedRows.has(r));
            if (!row) break;
            usedRows.add(row);
            applyRowVariant(row, ref, doHighlight, doApply);
        }
    }

    function applyFill(meta, answerText, doHighlight, doApply) {
        const pairs = parseKeyedPairs(answerText);
        const positional = splitRefs(answerText);
        meta.inputs.forEach((input, i) => {
            const value = pairs.size ? pairs.get('A' + i) : positional[i];
            if (value == null) return;
            if (doHighlight) markEl(input);
            if (doApply) setNativeValue(input, value);
        });
    }

    function applyShort(meta, answerText, doHighlight, doApply) {
        const input = meta.inputs[0];
        if (!input) return;
        const value = cleanRef(String(answerText || '').replace(/^[^:]{0,20}(?:відповідь|answer)\s*:\s*/i, ''));
        if (!value) return;
        if (doHighlight) markEl(input);
        if (doApply) setNativeValue(input, value);
    }

    async function applyOrder(meta, answerText, doHighlight, doApply) {
        if (!meta.list) return;
        const items = meta.list.items;
        const used = new Set();
        const ordered = [];
        for (const ref of splitRefs(answerText)) {
            const cand = resolveChoice(items.filter(it => !used.has(it)), ref);
            if (cand) { used.add(cand); ordered.push(cand); }
        }
        for (const it of items) if (!used.has(it)) ordered.push(it);
        if (doHighlight) ordered.forEach(it => markEl(it.el));
        if (!doApply) return;
        const order = ordered.map(it => itemKey(it.el));
        const reply = await requestReorder(order, 1500);
        if (!reply.ok && meta.type === 'order') {
            sortableFallbackReorder(meta.list.el, ordered);
        }
    }

    function applyAnswer(meta, answerText, questionEl) {
        if (!meta || !questionEl || !questionEl.isConnected) return;
        const settings = window.xdAnswers.settings || {};
        const silentMode = settings.silentMode || '';
        const curNum = getQuestionNumber();
        if (curNum && meta.qNum && curNum !== meta.qNum) return; // question changed while AI was thinking
        const doApply = settings.autoAnswer || silentMode === 'oneclick';
        const doHighlight = settings.highlightCorrect && silentMode === '';
        if (!doApply && !doHighlight) return;
        clearHighlights(questionEl);
        try {
            const type = meta.type;
            if (type === 'quiz' || type === 'select' || type === 'quiz_image') {
                applyChoiceList(meta, answerText, doHighlight, doApply);
            } else if (type === 'multiquiz' || type === 'multiquiz_image') {
                applyChoiceList(meta, answerText, doHighlight, doApply);
            } else if (type === 'truefalse') {
                applyTrueFalse(meta, answerText, doHighlight, doApply);
            } else if (type === 'short') {
                applyShort(meta, answerText, doHighlight, doApply);
            } else if (type === 'fill') {
                applyFill(meta, answerText, doHighlight, doApply);
            } else if (type === 'match' || type === 'match_image') {
                applyMatch(meta, answerText, doHighlight, doApply);
            } else if (type === 'order' || type === 'order2') {
                applyOrder(meta, answerText, doHighlight, doApply);
            }
        } catch (e) {
            console.warn('[xdAnswers] naurok-round apply failed:', e);
        }
    }

    // ---------------------------------------------------------------------
    // Wiring
    // ---------------------------------------------------------------------

    function prepareQuestionData(questionEl) {
        const meta = collectMeta(questionEl);
        if (!meta) return Promise.resolve(null);
        window.xdAnswers._customAutoAnswer = (answerText) => applyAnswer(meta, answerText, questionEl);
        const urls = [...new Set(meta.images)];
        const imgPromises = urls.map(u => Promise.resolve(window.xdAnswers.imageToBase64(u)).catch(() => null));
        return Promise.all(imgPromises).then(images => {
            return buildQuestionData(meta, images.filter(Boolean));
        });
    }

    function scanAndInject() {
        const questionEl = document.querySelector('question') || document.querySelector('.sth-question');
        if (!questionEl) return;
        const controls = questionEl.querySelector('.sth-question-controls');
        if (!controls) return;

        if (window.xdAnswers.settings.silentMode === 'oneclick') {
            if (!questionEl.classList.contains('xd-oneclick-ready')) {
                window.xdAnswers.setupOneClickHandler(questionEl, () => prepareQuestionData(questionEl));
            }
            return;
        }

        if (controls.querySelector('.xd-solve-btn')) return;
        const button = document.createElement('button');
        button.className = 'xd-btn xd-solve-btn';
        button.innerText = '✨ Solve';
        button.style.cssText = `background:rgba(99,102,241,0.1);border:1px solid rgba(99,102,241,0.5);color:#6366f1;padding:6px 14px;border-radius:6px;cursor:pointer;margin-top:10px;margin-left:10px;font-family:system-ui,-apple-system,sans-serif;font-weight:600;font-size:13px;z-index:9999;position:relative;transition:all 0.15s;`;
        button.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            window.xdAnswers._answerContainer = questionEl;
            prepareQuestionData(questionEl).then(data => {
                if (data) window.xdAnswers.processQuestion(data);
            });
        };
        controls.appendChild(button);
    }

    function initNaurokRound() {
        console.log('[xdAnswers] Naurok round provider loaded');
        window.xdAnswers.onRefresh = () => scanAndInject();

        let scanTimer = null;
        const debouncedScan = () => {
            clearTimeout(scanTimer);
            scanTimer = setTimeout(scanAndInject, 300);
        };

        const observer = new MutationObserver(() => {
            debouncedScan();
            if (window.xdAnswers.helperContainer && !document.body.contains(window.xdAnswers.helperContainer)) {
                document.body.appendChild(window.xdAnswers.helperContainer);
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
        scanAndInject();
    }
})();
