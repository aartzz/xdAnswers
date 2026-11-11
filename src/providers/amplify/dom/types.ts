// src/providers/amplify/dom/types.ts
// Shared DOM state for the Amplify Classroom provider.

export type AmplifyQuestionKind =
    | 'choice'
    | 'text'
    | 'expression'
    | 'table'
    | 'cardsort'
    | 'inline'
    | 'reorder'
    | 'slider'
    | 'survey'
    | 'graph'
    | 'sketch'
    | 'other';

export type AmplifyInlineKind = 'math' | 'text' | 'dropdown';

export interface AmplifyInlineField {
    id: string;
    kind: AmplifyInlineKind;
    element: HTMLElement;
    options: string[];
}

export interface AmplifyHotText {
    id: string;
    element: HTMLElement;
    text: string;
}

export interface AmplifyQuestionState {
    screenId: string;
    kind: AmplifyQuestionKind;
    text: string;
    options: string[];
    optionElements: HTMLElement[];
    textInputs: HTMLElement[];
    mathInputs: HTMLElement[];
    explainInputs: HTMLElement[];
    tableCells: HTMLElement[];
    inlineFields: AmplifyInlineField[];
    hotTexts: AmplifyHotText[];
    reorderItems: HTMLElement[];
    sliderThumb: HTMLElement | null;
    canvasElements: HTMLCanvasElement[];
    imageUrls: string[];
    questionType?: string;
    isMultiple: boolean;
    container: HTMLElement | null;
}
