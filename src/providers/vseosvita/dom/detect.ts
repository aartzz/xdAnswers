// src/providers/vseosvita/dom/detect.ts
// vseosvita question detection: legacy CSS heuristics first, then premium
// data-quest_type formats, then Google Forms-style fallbacks.
import type { VseosvitaMeta, VseosvitaQuestionData } from './index';
import { collectOptions, markOptionElements } from './options';
import { extractMathContent, getText } from './text';
import { collectTextInputs, findVrQuest } from './premium-collect';
import { collectCheckboxGrid, collectDateTime, collectGenericDropdown, collectLikert, collectScale } from './premium-grid';
import { detectPremiumFormat, premiumOptionsText, premiumQuestionType } from './premium';

export function detectQuestionData(): VseosvitaQuestionData | null {
    const questionRoot = document.querySelector('#i-test-question-uwj219, .v-test-question, .v-test-go-bg, .v-test-go-body, .Qr7Oae, .geS5n, .test-question-text, .vseosvita-test-content');
    if (!questionRoot) return null;

    const titleNode = questionRoot.querySelector('.v-test-questions-title .content-box, .v-test-questions-title p, .v-test-questions-title, .M7eMe, .test-question-text, .question-text');
    let text = getText(titleNode || questionRoot);
    if (!text) return null;

    // Append mathematical content (MathML, KaTeX, LaTeX) if present
    const mathText = extractMathContent(titleNode || questionRoot);
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

    // Fallback CSS-heuristic detection for Google Forms-style layouts
    // that don't carry data-quest_type. Runs only when both legacy and
    // premium (data-quest_type) branches returned unknown.
    if (questionType === 'unknown') {
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
                meta.vrQuest = findVrQuest(questionRoot);
                vseosvitaMeta = meta;
                questionType = premiumQuestionType(meta.formatType);
                break;
            }
        }
    }

    // Merge premium optionsText into the options list when no legacy options were found.
    let premiumOpts: string | undefined;
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
