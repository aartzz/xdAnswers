// src/providers/vseosvita/premium.ts
// vseosvita premium question formats: collectors for the data-quest_type
// layouts and the Google Forms-style grid/scale/dropdown fallbacks, plus the
// format -> questionType/optionsText mapping. Publishes its API on
// window.xdAnswers._internal.providerModules.vseosvita.premium for dom.ts.

import type { VseosvitaMeta } from './dom';

export interface VseosvitaPremiumApi {
    normalize(text: unknown): string;
    extractMathContent(el: Element | null): string;
    findVrQuest(questionRoot: Element | null): Element | null;
    collectTextInputs(vrQuest: Element): VseosvitaMeta | null;
    collectCheckboxGrid(questionRoot: Element): VseosvitaMeta | null;
    collectLikert(questionRoot: Element): VseosvitaMeta | null;
    collectScale(questionRoot: Element): VseosvitaMeta | null;
    collectGenericDropdown(questionRoot: Element): VseosvitaMeta | null;
    collectDateTime(questionRoot: Element): VseosvitaMeta | null;
    detectPremiumFormat(questionRoot: Element): VseosvitaMeta | null;
    premiumOptionsText(meta: VseosvitaMeta | null): string | undefined;
    premiumQuestionType(formatType: string): string;
}

(function () {
    'use strict';

    window.xdAnswers = window.xdAnswers || ({} as XdAnswers);
    window.xdAnswers._internal = window.xdAnswers._internal || ({} as XdAnswersInternal);

    const I = window.xdAnswers._internal;
    I.providerModules = I.providerModules || {};
    const ns = (I.providerModules.vseosvita = I.providerModules.vseosvita || {});

    // ── Premium format support (dispatched by data-quest_type attribute) ──
    // These handlers cover vseosvita premium question formats that the legacy
    // CSS-heuristic branch doesn't recognise. They kick in ONLY when the
    // heuristic branch returns questionType='unknown'.

    // Find the .vr-quest wrapper carrying data-quest_type, starting from questionRoot.
    function findVrQuest(questionRoot: Element | null): Element | null {
        if (!questionRoot) return null;
        return questionRoot.closest?.('.vr-quest[data-quest_type]')
            || questionRoot.querySelector?.('.vr-quest[data-quest_type]')
            || null;
    }

    // Format normalisation: vseosvita uses a mix of non-breaking spaces and odd whitespace.
    function normalize(text: unknown): string {
        return String(text || '').replace(/[\u00A0\u200B\u200C\u200D\uFEFF]/g, ' ').replace(/\s+/g, ' ').trim();
    }

    // Extract mathematical content from elements (MathML, KaTeX, LaTeX).
    function extractMathContent(el: Element | null): string {
        if (!el) return '';
        let mathText = '';
        // MathML
        el.querySelectorAll('math, .mathml').forEach(m => {
            mathText += ' ' + (m.textContent || '').trim();
        });
        // KaTeX
        el.querySelectorAll('.katex, .katex-display, .katex-mathml').forEach(k => {
            mathText += ' ' + (k.textContent || '').trim();
        });
        // data-math attribute
        el.querySelectorAll('[data-math]').forEach(dm => {
            mathText += ' ' + (dm.getAttribute('data-math') || '').trim();
        });
        // Inline LaTeX $...$
        const text = el.textContent || '';
        const latexMatches = text.match(/\$[^$]+\$/g);
        if (latexMatches) {
            mathText += ' ' + latexMatches.join(' ');
        }
        return mathText.trim();
    }

    // ── Type 12: true/false ────────────────────────────────────────────
    function collectTrueFalse(vrQuest: Element): VseosvitaMeta | null {
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
    function collectTextInputs(vrQuest: Element): VseosvitaMeta | null {
        // Prefer labels because they carry the field ordering semantic ("Відповідь 1:", ...)
        const inputs: Array<{ label: string; element: HTMLInputElement }> = [];
        vrQuest.querySelectorAll('label').forEach(label => {
            const input = label.querySelector('input[type="text"]');
            if (input) {
                const labelText = normalize(label.childNodes[0]?.textContent) || normalize(label.textContent).split(':')[0];
                inputs.push({ label: labelText || `Поле ${inputs.length + 1}`, element: input as HTMLInputElement });
            }
        });
        // Fallback: any text input directly inside the quest
        if (inputs.length === 0) {
            vrQuest.querySelectorAll('input[type="text"]').forEach((input, idx) => {
                inputs.push({ label: `Поле ${idx + 1}`, element: input as HTMLInputElement });
            });
        }
        if (inputs.length === 0) return null;
        return {
            formatType: inputs.length > 1 ? 'text_input_multi' : 'text_input_single',
            inputs
        };
    }

    // ── Type 6: fill-in-blank (inline contenteditable spans) ───────────
    function collectFillBlanks(vrQuest: Element): VseosvitaMeta | null {
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
    function collectSelectInText(vrQuest: Element): VseosvitaMeta | null {
        const spans = Array.from(vrQuest.querySelectorAll('span.vr-fill-the-gap-select.vr-control[data-key]'));
        if (spans.length === 0) return null;
        const blanks = spans.map(span => {
            const key = span.getAttribute('data-key') || '';
            // Look for the options listed in the sibling/next element
            let options: string[] = [];
            let sibling: Element | null = span.nextElementSibling;
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
    function collectOrderingSelect(vrQuest: Element): VseosvitaMeta | null {
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
    function collectOrderWords(vrQuest: Element): VseosvitaMeta | null {
        const tokens = Array.from(vrQuest.querySelectorAll('.word-queue-test_question_sentence-wrap-testing .word-queue-test_question_sentence-item'));
        if (tokens.length < 2) return null;
        const items = tokens.map(t => ({ text: normalize(t.textContent), element: t })).filter(t => t.text);
        if (items.length < 2) return null;
        return { formatType: 'order_words', tokens: items };
    }

    // ── Type 18: free-response (essay / textarea) ──────────────────────
    function collectFreeResponse(vrQuest: Element): VseosvitaMeta | null {
        const textarea = vrQuest.querySelector('textarea') || vrQuest.querySelector('[contenteditable="true"]');
        // Static dumps may have no textarea (preview mode) — still classify the type
        // so the AI prompt triggers and autoSelectAnswer's fallback branch can fill
        // the textarea that vseosvita renders at runtime.
        return { formatType: 'free_response', element: textarea || null };
    }

    // ── Grid / Matrix formats (Google Forms-style CSS heuristics) ──────
    // checkboxGrid: multiple choice matrix (.mxSrOe rows, .uVccjd checkboxes)
    function collectCheckboxGrid(questionRoot: Element): VseosvitaMeta | null {
        const rows = Array.from(questionRoot.querySelectorAll('.mxSrOe'));
        if (rows.length === 0) return null;
        const items = rows.map((row, idx) => {
            const label = normalize(row.querySelector('.Wtw8H, .RHiBW')?.textContent) || `Рядок ${idx + 1}`;
            const checks = Array.from(row.querySelectorAll('.uVccjd')).map(cb => ({
                text: normalize(cb.querySelector('.aDTYNe, .docssharedWizToggleLabeledLabelText')?.textContent) || '',
                element: cb.querySelector('input[type="checkbox"]') || cb
            })).filter(c => c.text);
            return { label, checks };
        }).filter(r => r.checks.length > 0);
        if (items.length === 0) return null;
        return { formatType: 'checkbox_grid', rows: items };
    }

    // likert: radio button matrix / grid (.lLfZXe radiogroups, .Od2TWd radios)
    function collectLikert(questionRoot: Element): VseosvitaMeta | null {
        const groups = Array.from(questionRoot.querySelectorAll('.lLfZXe'));
        if (groups.length === 0) return null;
        const items = groups.map((group, idx) => {
            const label = normalize(group.querySelector('.Wtw8H, .RHiBW')?.textContent) || `Рядок ${idx + 1}`;
            const radios = Array.from(group.querySelectorAll('.Od2TWd')).map(r => ({
                text: normalize(r.querySelector('.aDTYNe, .docssharedWizToggleLabeledLabelText')?.textContent) || '',
                element: r.querySelector('input[type="radio"]') || r
            })).filter(r => r.text);
            return { label, radios };
        }).filter(r => r.radios.length > 0);
        if (items.length === 0) return null;
        return { formatType: 'likert', rows: items };
    }

    // scale: linear scale 1-10 (.N9Qcwe container, .T5pZmf items)
    function collectScale(questionRoot: Element): VseosvitaMeta | null {
        const container = questionRoot.querySelector('.N9Qcwe');
        if (!container) return null;
        const items = Array.from(container.querySelectorAll('.T5pZmf')).map(el => ({
            text: normalize(el.textContent) || '',
            element: el.querySelector('input[type="radio"]') || el
        })).filter(i => i.text);
        if (items.length === 0) return null;
        return { formatType: 'scale', items };
    }

    // generic dropdown (.jgvuAb[role="listbox"] with .MocG8c[role="option"] options)
    function collectGenericDropdown(questionRoot: Element): VseosvitaMeta | null {
        const listbox = questionRoot.querySelector('.jgvuAb[role="listbox"]');
        if (!listbox) return null;
        const options = Array.from(questionRoot.querySelectorAll('.MocG8c[role="option"]')).map(opt => ({
            text: normalize(opt.textContent) || '',
            element: opt
        })).filter(o => o.text);
        if (options.length === 0) return null;
        return { formatType: 'dropdown', element: listbox, options };
    }

    // date / time inputs
    function collectDateTime(questionRoot: Element): VseosvitaMeta | null {
        const dateInput = questionRoot.querySelector('input[type="date"]');
        const timeInputs = questionRoot.querySelectorAll('input[jsname="MKaSrf"], input[jsname="QbtXXe"]');
        if (!dateInput && timeInputs.length === 0) return null;
        return {
            formatType: 'date_time',
            dateElement: dateInput || null,
            timeElements: Array.from(timeInputs)
        };
    }

    // ── Type 10 / Categorization: drag-and-drop items into categories ───
    // Heuristic: container with category titles and draggable items that
    // must be distributed among the categories.
    function collectCategorization(vrQuest: Element): VseosvitaMeta | null {
        // Look for category headers and draggable items
        const catHeaders = Array.from(vrQuest.querySelectorAll('.vr-category-title, .category-title, .vr-cat-header, [data-testid="category-header"]'));
        const items = Array.from(vrQuest.querySelectorAll('.vr-categorization-item, .categorization-item, .draggable-item, [draggable="true"], [data-testid="categorizer-item"]'));

        if (catHeaders.length < 2 || items.length < 2) return null;

        const categories = catHeaders.map(h => normalize(h.textContent)).filter(Boolean);
        const itemTexts = items.map(it => normalize(it.textContent)).filter(Boolean);

        if (categories.length < 2 || itemTexts.length < 2) return null;

        return {
            formatType: 'categorization',
            categories,
            items: items.map((el, idx) => ({ text: itemTexts[idx] || '', element: el })).filter(i => i.text),
            categoryElements: catHeaders.map(el => ({ text: normalize(el.textContent), element: el }))
        };
    }

    function detectPremiumFormat(questionRoot: Element): VseosvitaMeta | null {
        const vrQuest = findVrQuest(questionRoot);
        if (!vrQuest) return null;
        const dqt = vrQuest.getAttribute('data-quest_type');
        if (!dqt) return null;

        let meta: VseosvitaMeta | null = null;
        switch (dqt) {
            case '3':  meta = collectTextInputs(vrQuest); break;    // single input
            case '5':  meta = collectTextInputs(vrQuest); break;    // multi input (same collector, distinguishes by count)
            case '6':  meta = collectFillBlanks(vrQuest); break;
            case '7':  meta = collectSelectInText(vrQuest); break;
            case '8':  meta = collectOrderingSelect(vrQuest); break; // fallback only - legacy branch usually catches this
            case '10': meta = collectCategorization(vrQuest); break; // categorization / drag-drop
            case '12': meta = collectTrueFalse(vrQuest); break;
            case '13': meta = collectOrderWords(vrQuest); break;
            case '18': meta = collectFreeResponse(vrQuest); break;
            default:
                // Fallback heuristic for categorization when data-quest_type is absent/unknown
                meta = collectCategorization(vrQuest);
                if (!meta) return null;
                break;
        }
        if (!meta) return null;
        meta.vrQuest = vrQuest;
        meta.dataQuestType = dqt;
        return meta;
    }

    // Build the AI-side optionsText for formats that expose choices.
    function premiumOptionsText(meta: VseosvitaMeta | null): string | undefined {
        if (!meta) return undefined;
        if (meta.formatType === 'true_false') {
            return meta.buttons.map((b: any, i: number) => `${String.fromCharCode(65 + i)}: ${b.text}`).join('\n');
        }
        if (meta.formatType === 'order_words') {
            return meta.tokens.map((t: any) => `- ${t.text}`).join('\n');
        }
        if (meta.formatType === 'text_input_multi') {
            return meta.inputs.map((i: any) => `- ${i.label}`).join('\n');
        }
        if (meta.formatType === 'fill_blank') {
            return meta.blanks.map((b: any) => `- Пропуск ${b.key}`).join('\n');
        }
        if (meta.formatType === 'select_in_text') {
            return meta.blanks
                .map((b: any) => `- ${b.key}: [${b.options.join(' | ')}]`)
                .join('\n');
        }
        if (meta.formatType === 'ordering_select') {
            return meta.items.map((i: any) => `- ${i.text}`).join('\n');
        }
        if (meta.formatType === 'checkbox_grid') {
            return meta.rows.map((r: any) => `- ${r.label}:\n  ${r.checks.map((c: any) => `[ ] ${c.text}`).join('\n  ')}`).join('\n');
        }
        if (meta.formatType === 'likert') {
            return meta.rows.map((r: any) => `- ${r.label}:\n  ${r.radios.map((radio: any) => `( ) ${radio.text}`).join('  ')}`).join('\n');
        }
        if (meta.formatType === 'scale') {
            return meta.items.map((it: any, i: number) => `${i + 1}: ${it.text}`).join('  ');
        }
        if (meta.formatType === 'dropdown') {
            return meta.options.map((o: any, i: number) => `${String.fromCharCode(65 + i)}: ${o.text}`).join('\n');
        }
        if (meta.formatType === 'categorization') {
            return 'Категорії:\n' + meta.categories.map((c: any) => `- ${c}`).join('\n') +
                   '\n\nЕлементи для розподілу:\n' + meta.items.map((it: any) => `- ${it.text}`).join('\n');
        }
        return undefined;
    }

    // Map premium formatType to the existing questionType vocabulary that
    // src/ai/request.ts understands (plus new ones we're adding).
    function premiumQuestionType(formatType: string): string {
        switch (formatType) {
            case 'true_false':       return 'true_false';
            case 'text_input_single':return 'short_text';
            case 'text_input_multi': return 'text_input_multi';
            case 'fill_blank':       return 'fill_blank';
            case 'select_in_text':   return 'select_in_text';
            case 'order_words':      return 'order_words';
            case 'ordering_select':  return 'ordering';
            case 'categorization':   return 'categorization';
            case 'free_response':    return 'paragraph';
            case 'checkbox_grid':    return 'checkbox_grid';
            case 'likert':           return 'likert';
            case 'scale':            return 'scale';
            case 'dropdown':         return 'dropdown';
            case 'date_time':        return 'date_time';
            default:                 return 'unknown';
        }
    }
    ns.premium = {
        normalize,
        extractMathContent,
        findVrQuest,
        collectTextInputs,
        collectCheckboxGrid,
        collectLikert,
        collectScale,
        collectGenericDropdown,
        collectDateTime,
        detectPremiumFormat,
        premiumOptionsText,
        premiumQuestionType
    } as VseosvitaPremiumApi;
})();
