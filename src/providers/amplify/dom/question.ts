// src/providers/amplify/dom/question.ts
// Orchestrates the Amplify/Desmos screen readers into a single question state.

import { collectChoice } from './choice';
import { collectExplainInputs, collectMathInputs, collectTableCells, collectTextInputs } from './inputs';
import { collectHotTexts, collectInlineFields } from './inline';
import { collectCanvasElements, collectImages } from './media';
import { collectQuestionText } from './question-text';
import { currentScreen, screenIdOf } from './screen';
import { cleanText } from './util';
import { collectCardOptions, collectReorderItems, collectSliderThumb, hasSurveyChoices } from './widgets';
import type { AmplifyQuestionKind, AmplifyQuestionState } from './types';

export function readQuestion(): AmplifyQuestionState | null {
    const screen = currentScreen();
    if (!screen) return null;

    const screenId = screenIdOf(screen);
    const optionData = collectChoice(screen);
    const textInputs = collectTextInputs(screen);
    const mathInputs = collectMathInputs(screen);
    const explainInputs = collectExplainInputs(screen);
    const tableCells = collectTableCells(screen);
    const cardOptions = collectCardOptions(screen);
    const inlineFields = collectInlineFields(screen);
    const hotTexts = collectHotTexts(screen);
    const reorderItems = collectReorderItems(screen);
    const sliderThumb = collectSliderThumb(screen);
    const canvases = collectCanvasElements(screen);

    let kind: AmplifyQuestionKind = 'other';
    if (optionData.elements.length) kind = 'choice';
    else if (cardOptions.length) kind = 'cardsort';
    else if (inlineFields.length || hotTexts.length) kind = 'inline';
    else if (reorderItems.length) kind = 'reorder';
    else if (sliderThumb) kind = 'slider';
    else if (textInputs.length) kind = 'text';
    else if (mathInputs.length) kind = 'expression';
    else if (tableCells.length) kind = 'table';
    else if (hasSurveyChoices(screen)) kind = 'survey';
    else if (screen.querySelector('[data-component-type="input/graph"], [data-component-type="graph"]')) kind = 'graph';
    else if (screen.querySelector('[data-component-type="sketch"]')) kind = 'sketch';

    const text = collectQuestionText(screen, kind, inlineFields, hotTexts);
    let options = kind === 'choice' ? optionData.options : kind === 'cardsort' ? cardOptions : [];
    if (kind === 'reorder') {
        options = reorderItems.map(item => {
            const content = item.querySelector('.item-content');
            return cleanText((content as HTMLElement | null)?.innerText || item.getAttribute('aria-label') || item.innerText || '');
        }).filter(Boolean);
    }
    if (kind === 'table') {
        options = tableCells.map((cell, index) => {
            const value = cleanText((cell as HTMLElement).innerText || cell.textContent || '');
            return value ? `Комірка ${index + 1}: ${value}` : `Комірка ${index + 1}`;
        });
    }

    let questionType: string | undefined;
    if (kind === 'choice') questionType = 'quiz';
    else if (kind === 'cardsort') questionType = 'match_pairs';
    else if (kind === 'inline') questionType = 'inline_fill';
    else if (kind === 'reorder') questionType = 'ordering';
    else if (kind === 'slider') questionType = 'range';
    else if (kind === 'table') questionType = 'text_input_multi';

    const imageUrls = collectImages(screen);
    const components = screen.querySelectorAll('[data-component-type]').length;
    if (!text && !options.length && !imageUrls.length && !canvases.length && !components) return null;

    return {
        screenId,
        kind,
        text,
        options,
        optionElements: optionData.elements,
        textInputs,
        mathInputs,
        explainInputs,
        tableCells,
        inlineFields,
        hotTexts,
        reorderItems,
        sliderThumb,
        canvasElements: canvases,
        imageUrls,
        questionType,
        isMultiple: optionData.isMultiple,
        container: screen.querySelector<HTMLElement>('.student-step-container') || screen
    };
}

export async function loadImages(urls: string[]): Promise<string[]> {
    const images = await Promise.all(urls.map(url => window.xdAnswers.imageToBase64(url)));
    return images.filter((img): img is string => img !== null);
}
