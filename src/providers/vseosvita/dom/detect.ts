// src/providers/vseosvita/dom/detect.ts
// vseosvita question detection: runtime component classes first, then the
// data-quest_type compatibility layouts, Google Forms-style structural
// fallbacks and finally legacy CSS heuristics.
import type { VseosvitaMeta, VseosvitaQuestionData } from './index';
import { collectOptions, markOptionElements } from './options';
import { extractMathContent, getText } from './text';
import { findVrQuest } from './premium-collect';
import { collectCheckboxGrid, collectDateTime, collectGenericDropdown, collectLikert, collectScale } from './premium-grid';
import { detectPremiumFormat, detectRuntimeFormat, premiumOptionsText, premiumQuestionType } from './premium';

// Google Forms / shared form components use role=listitem for a question and
// role=heading for its title. These attributes survive class renames.
function findStructuredFormRoot(): Element | null {
    const items = Array.from(document.querySelectorAll('[role="listitem"]'));
    for (const item of items) {
        if (item.querySelector('[role="heading"], [role="radio"], [role="checkbox"], [data-field-index], [role="listbox"]')) {
            return item;
        }
    }
    return null;
}

function findSingleQuestionRoot(): Element | null {
    return document.querySelector('[id^="i-test-question-"], .v-test-question, .v-test-go-bg, .v-test-go-body, .v-test-questions-block, .test-question-text, .vseosvita-test-content')
        || findStructuredFormRoot();
}

// Wall-mode tests render every question into one page instead of fetching
// them one at a time through the test-pupil API. Keep the roots separate so
// each question can be scoped to its own options and text inputs.
export function detectQuestionRoots(): Element[] {
    const wall = document.querySelector('.n-is-wall-mode');
    if (wall) {
        const roots = Array.from(wall.querySelectorAll('.v-test-go-bg'))
            .filter(root => !root.parentElement?.closest('.v-test-go-bg'));
        if (roots.length > 1) return roots;
    }

    const idRoots = Array.from(document.querySelectorAll('[id^="i-test-question-"]'));
    if (idRoots.length > 1) return idRoots;

    const bgRoots = Array.from(document.querySelectorAll('.v-test-go-bg'))
        .filter(root => !root.parentElement?.closest('.v-test-go-bg'));
    if (bgRoots.length > 1) return bgRoots;

    const single = findSingleQuestionRoot();
    return single ? [single] : [];
}

export function detectQuestionData(root?: Element | null): VseosvitaQuestionData | null {
    const questionRoot = root || detectQuestionRoots()[0] || findStructuredFormRoot();
    if (!questionRoot) return null;

    const titleNode = questionRoot.querySelector('.v-test-questions-title .content-box, .v-test-questions-title p, .test-question-text, .question-text, [role="heading"]')
        || questionRoot.querySelector('.v-test-questions-title');
    let text = getText(titleNode || questionRoot);
    if (!text) return null;

    // Append mathematical content (MathML, KaTeX, LaTeX) if present
    const mathText = extractMathContent(titleNode || questionRoot);
    if (mathText) {
        text += '\n[Math]: ' + mathText;
    }

    const scope = findVrQuest(questionRoot) || questionRoot;

    // Mark option elements for auto-answer/indicators
    markOptionElements(scope);

    const options = collectOptions(scope);

    // Collect images from question title first, then from the rest of the question.
    // Prefer data-src because vseosvita lazy-loads question and answer images.
    const collectImages = (root: Element): string[] => Array.from(root.querySelectorAll('img, image'))
        .map(img => img.getAttribute('data-src')
            || img.getAttribute('src')
            || img.getAttribute('href')
            || img.getAttribute('xlink:href')
            || '')
        .filter((src): src is string => !!src);
    const titleImgs = collectImages(titleNode || questionRoot);
    const otherImgs = collectImages(questionRoot);
    const imgs = [...new Set([...titleImgs, ...otherImgs])];

    // 1. Current runtime component classes. This is the authoritative path;
    //    data-quest_type is no longer present in the live vseosvita bundle.
    let vseosvitaMeta: VseosvitaMeta | null = detectRuntimeFormat(scope);

    // 2. Compatibility with the old data-quest_type markup.
    if (!vseosvitaMeta) {
        vseosvitaMeta = detectPremiumFormat(questionRoot);
    }

    // 3. Google Forms-style layouts. Detect these before the simple
    //    radio/checkbox heuristic so a checkbox grid is not misread as an
    //    ordinary multiquiz. The collectors use roles and data attributes, so
    //    rotating obfuscated classes do not affect them.
    if (!vseosvitaMeta) {
        const fallbackDetectors = [
            collectCheckboxGrid,
            collectLikert,
            collectScale,
            collectGenericDropdown,
            collectDateTime
        ];
        for (const detector of fallbackDetectors) {
            const meta = detector(questionRoot);
            if (meta) {
                vseosvitaMeta = meta;
                break;
            }
        }
    }

    let questionType = 'unknown';
    let isMultiQuiz = false;

    if (vseosvitaMeta) {
        questionType = premiumQuestionType(vseosvitaMeta.formatType);
        isMultiQuiz = vseosvitaMeta.formatType === 'checkbox_grid'
            || (vseosvitaMeta.formatType === 'image_quiz' && !!vseosvitaMeta.isMulti);
        vseosvitaMeta.vrQuest = scope;
    } else {
        // 4. Legacy CSS heuristics for simple radio/checkbox/text/matching DOM.
        const hasTextInput = scope.querySelector('.a-test-lab-inp input[type="text"]') !== null;
        const hasCheckbox = scope.querySelector('input[type="checkbox"], [role="checkbox"]') !== null;
        const hasRadio = scope.querySelector('input[type="radio"], [role="radio"]') !== null;
        const hasMatching = scope.querySelector('.matching-question, .matching-block') !== null;
        const hasOrdering = scope.querySelector('.row_draggable-question, .draggable-question-box') !== null;

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
    }

    // Prefer the format-aware options text whenever a premium/runtime format
    // was recognised. The generic selector list is often wrong for these
    // components (cross pairs, card drags, sortable baskets, ...).
    const premiumOpts = vseosvitaMeta ? premiumOptionsText(vseosvitaMeta) : undefined;

    return {
        root: questionRoot,
        text,
        options,
        optionsText: premiumOpts || options.join('\n') || undefined,
        base64ImageSources: imgs,
        questionType,
        isMultiQuiz,
        isMulti: isMultiQuiz,
        vseosvitaMeta
    };
}
