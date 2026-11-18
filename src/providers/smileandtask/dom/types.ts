// src/providers/smileandtask/dom/types.ts
// Shared DOM state and sessionStorage shapes for the S&T School provider.

export type StKind = 'choice' | 'multi' | 'text' | 'multi_text' | 'matching' | 'ordering';

export interface StOption {
    index: number;
    text: string;
    image: string | null;
    label: HTMLElement | null;
    control: HTMLElement;
    lock: HTMLElement | null;
}

export interface StTextInput {
    element: HTMLInputElement;
    label: string;
}

export interface StMatchRow {
    index: number;
    text: string;
    image: string | null;
    assign: HTMLButtonElement;
    /** Text currently assigned to the row ('' when empty). */
    value: string;
}

export interface StMatchRight {
    index: number;
    text: string;
    image: string | null;
    button: HTMLButtonElement;
}

export interface StOrderSlot {
    index: number;
    button: HTMLButtonElement;
    /** Text currently placed in the slot ('' when empty). */
    value: string;
}

export interface StOrderItem {
    index: number;
    text: string;
    image: string | null;
    button: HTMLButtonElement;
}

export interface StQuestionState {
    number: number;
    text: string;
    kind: StKind;
    /** The question card; used as the answer / one-click container. */
    container: HTMLElement;
    options: StOption[];
    textInputs: StTextInput[];
    matchRows: StMatchRow[];
    matchRights: StMatchRight[];
    orderSlots: StOrderSlot[];
    orderItems: StOrderItem[];
    imageUrls: string[];
    /** Exact number of options to pick ("Вибрано: 1 / 3"), when the player shows it. */
    limit: number | null;
    /** Options are hidden behind hold-to-reveal and still need revealOptions(). */
    needsReveal: boolean;
    /** The question is already saved and the controls are locked. */
    locked: boolean;
}

export interface StoredImage {
    url?: string;
    alt?: string;
}

export interface StoredQuestion {
    id?: string;
    question?: string;
    type?: string;
    options?: string[];
    optionImages?: Array<StoredImage | null>;
    pairImages?: Array<StoredImage | null>;
    image?: StoredImage;
}

export interface StoredTask {
    id?: string;
    title?: string;
    description?: string;
    subject?: string;
    questions?: StoredQuestion[];
}
