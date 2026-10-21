// src/providers/vseosvita/dom.ts
// vseosvita DOM extraction: question text, answer options, premium question
// formats (data-quest_type 3/5/6/7/8/10/12/13/18 plus Google Forms-style grids,
// scales, dropdowns and date inputs) and images. Publishes its API on
// window.xdAnswers._internal.providerModules.vseosvita.dom for apply.ts and main.ts.
import type { VseosvitaPremiumApi } from './premium';

export interface VseosvitaMeta {
    formatType: string;
    vrQuest?: Element | null;
    dataQuestType?: string | null;
    [key: string]: any;
}

export interface VseosvitaQuestionData {
    root: Element;
    text: string;
    options: string[];
    optionsText: string | undefined;
    base64ImageSources: string[];
    questionType: string;
    isMultiQuiz: boolean;
    isMulti: boolean;
    vseosvitaMeta: VseosvitaMeta | null;
}

export interface VseosvitaDomApi {
    detectQuestionData(): VseosvitaQuestionData | null;
    markOptionElements(questionRoot: Element): void;
}

(function () {
    'use strict';

    window.xdAnswers = window.xdAnswers || ({} as XdAnswers);
    window.xdAnswers._internal = window.xdAnswers._internal || ({} as XdAnswersInternal);

    const I = window.xdAnswers._internal;
    I.providerModules = I.providerModules || {};
    const ns = (I.providerModules.vseosvita = I.providerModules.vseosvita || {});

    const premium = ns.premium as VseosvitaPremiumApi;
    function getText(el: Element | null | undefined): string {
        return ((el as HTMLElement | null)?.innerText || el?.textContent || '').replace(/\s+/g, ' ').trim();
    }

    function collectMatchingOptions(questionRoot: Element): string[] {
        const wrapper = questionRoot.querySelector('.v-block-answers-cross-wrapper');
        if (!wrapper) return [];

        const items: Array<{ key: string; combined: string }> = [];
        const seen = new Set<string>();

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

    function collectOptions(questionRoot: Element): string[] {
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

        const seen = new Set<string>();
        const options: string[] = [];
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
    // in src/dom can find them for auto-answer and indicator modes
    function markOptionElements(questionRoot: Element): void {
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
        // Premium format interactive elements (types 12, 13)
        // type 12 - true/false buttons
        questionRoot.querySelectorAll('button.item-true-false').forEach(btn => {
            btn.setAttribute('data-xd-option', 'true');
        });
        // type 13 - order-words clickable tokens
        questionRoot.querySelectorAll('.word-queue-test_question_sentence-item').forEach(token => {
            token.setAttribute('data-xd-option', 'true');
        });
        // Grid / Matrix / Scale / Dropdown (Google Forms-style CSS)
        questionRoot.querySelectorAll('.mxSrOe .uVccjd, .lLfZXe .Od2TWd, .N9Qcwe .T5pZmf, .MocG8c[role="option"]').forEach(el => {
            el.setAttribute('data-xd-option', 'true');
        });
    }


    function detectQuestionData(): VseosvitaQuestionData | null {
        const questionRoot = document.querySelector('#i-test-question-uwj219, .v-test-question, .v-test-go-bg, .v-test-go-body, .Qr7Oae, .geS5n, .test-question-text, .vseosvita-test-content');
        if (!questionRoot) return null;

        const titleNode = questionRoot.querySelector('.v-test-questions-title .content-box, .v-test-questions-title p, .v-test-questions-title, .M7eMe, .test-question-text, .question-text');
        let text = getText(titleNode || questionRoot);
        if (!text) return null;

        // Append mathematical content (MathML, KaTeX, LaTeX) if present
        const mathText = premium.extractMathContent(titleNode || questionRoot);
        if (mathText) {
            text += '\n[Math]: ' + mathText;
        }

        // Mark option elements for auto-answer/indicators
        markOptionElements(questionRoot);

        const options = collectOptions(questionRoot);

        // Collect images from question title first, then from the rest of the question
        const titleImgs = Array.from(
            (titleNode || questionRoot).querySelectorAll('img')
        ).map(img => img.src || img.getAttribute('data-src')).filter((s): s is string => !!s);
        const otherImgs = Array.from(
            questionRoot.querySelectorAll('img')
        ).map(img => img.src || img.getAttribute('data-src')).filter((s): s is string => !!s);
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

        // Premium format detection via data-quest_type attribute.
        // Only runs when legacy CSS heuristics didn't recognise the format —
        // so existing working types (quiz/multiquiz/matching/ordering/short_text)
        // are not affected.
        let vseosvitaMeta: VseosvitaMeta | null = null;
        if (questionType === 'unknown') {
            vseosvitaMeta = premium.detectPremiumFormat(questionRoot);
            if (vseosvitaMeta) {
                questionType = premium.premiumQuestionType(vseosvitaMeta.formatType);
            }
        } else if (questionType === 'short_text') {
            // Upgrade path: legacy branch classifies type 5 (multi-input) as
            // short_text because it sees `a-test-lab-inp` + input[type=text].
            // If data-quest_type="5" we override to text_input_multi so the
            // multi-field applier runs. Does NOT affect genuine type 3 /
            // short_text — those stay on the legacy path.
            const vq = premium.findVrQuest(questionRoot);
            if (vq && vq.getAttribute('data-quest_type') === '5') {
                const meta = premium.collectTextInputs(vq);
                if (meta && meta.formatType === 'text_input_multi') {
                    vseosvitaMeta = meta;
                    vseosvitaMeta.vrQuest = vq;
                    vseosvitaMeta.dataQuestType = '5';
                    questionType = 'text_input_multi';
                }
            }
        }

        // Fallback CSS-heuristic detection for Google Forms-style layouts
        // that don't carry data-quest_type. Runs only when both legacy and
        // premium (data-quest_type) branches returned unknown.
        if (questionType === 'unknown') {
            const fallbackDetectors = [
                premium.collectCheckboxGrid,
                premium.collectLikert,
                premium.collectScale,
                premium.collectGenericDropdown,
                premium.collectDateTime
            ];
            for (const detector of fallbackDetectors) {
                const meta = detector(questionRoot);
                if (meta) {
                    meta.vrQuest = premium.findVrQuest(questionRoot);
                    vseosvitaMeta = meta;
                    questionType = premium.premiumQuestionType(meta.formatType);
                    break;
                }
            }
        }

        // Merge premium optionsText into the options list when no legacy options were found.
        let premiumOpts: string | undefined;
        if (vseosvitaMeta && !options.length) {
            premiumOpts = premium.premiumOptionsText(vseosvitaMeta);
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

    ns.dom = {
        detectQuestionData,
        markOptionElements
    } as VseosvitaDomApi;
})();
