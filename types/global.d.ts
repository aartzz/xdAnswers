// Global API surface of the xdAnswers page-world namespace.
//
// Every core module and provider attaches its public surface to
// `window.xdAnswers` (root) and `window.xdAnswers._internal` (shared internals).
// This file mirrors the inventory in the TS migration plan: 41 root members,
// 59 `_internal` members. `_buildVersion` is generated into `version.js` at
// package time and kept here for typing only.
//
// Note: the popup document loads only a subset of the core scripts, so at
// runtime it sees a partial `_internal` object. The types describe the full
// page-world surface; popup code should stay defensive.

interface XdProviderConfig {
    id: string;
    type: string;
    name: string;
    baseUrl: string;
    apiKey: string;
    /** Search providers use `kind: 'search'`. */
    kind?: string;
    model?: string;
    [key: string]: unknown;
}

interface XdConsensusRun {
    providerId?: string;
    model?: string;
    [key: string]: unknown;
}

interface XdConsensusSettings {
    enabled: boolean;
    runs: XdConsensusRun[];
}

interface XdCustomization {
    glowEffect: boolean;
    borderColor: string;
    contentColor: string;
    headerColor: string;
    textColor: string;
}

interface XdSettings {
    providers: XdProviderConfig[];
    activeProviderId: string;
    model: string;
    promptPrefix: string;
    language: string;
    autoAnswer: boolean;
    autoAnswerCooldown: number;
    highlightCorrect: boolean;
    showAnswerOnly: boolean;
    /** '' | 'indicators' | 'ghost' | 'stealth' | 'oneclick' */
    silentMode: string;
    _silentModePreselect: string;
    hotkey: string;
    webSearchEnabled: boolean;
    calculatorEnabled: boolean;
    themeEngine: string;
    defaultPosition: string;
    rememberDragPosition: boolean;
    savedPosition: { top: number; left: number } | null;
    disablerEnabled: boolean;
    customization: XdCustomization;
    consensus: XdConsensusSettings;
    customThemes: unknown[];
    [key: string]: unknown;
}

interface XdEffectiveSettings {
    apiFormat: string;
    baseUrl: string;
    apiKey: string;
    model: string;
    promptPrefix: string;
    webSearchEnabled: boolean;
    calculatorEnabled: boolean;
    themeEngine: string;
}

/** Shape passed by providers into `processQuestion`. */
interface XdQuestionData {
    text: string;
    optionsText?: string;
    base64Images?: Array<string | null> | null;
    topic?: string;
    topicDescription?: string;
    questionType?: string;
    batchQuestions?: unknown;
    customPromptPrefix?: string;
    [key: string]: unknown;
}

/** Parsed AI answer, stored in `lastParsedResponse` and rendered by the helper. */
interface XdParsedResponse {
    answer?: string;
    explanation?: string;
    solution?: string;
    confidence?: string | number;
    raw?: string;
    isJSON?: boolean;
    isStructured?: boolean;
    parseFailed?: boolean;
    isPartial?: boolean;
    isPartialJSON?: boolean;
    extractedBy?: string;
    /** Marks a parsed response produced by the JustClass provider. */
    _justclass?: boolean;
    _justclassShort?: string[];
}

/** Event emitted by `_internal.parseSSEChunks` for one API stream chunk. */
interface XdSseEvent {
    done?: boolean;
    content?: string;
    thinking?: string;
    tool_call_start?: { index: number; id?: string; name?: string };
    tool_call_delta?: { index: number; id?: string; name?: string; argsDelta: string };
    tool_call_args_delta?: { index: number; argsDelta: string };
    tool_call_stop?: boolean;
    tool_call_complete?: { name?: string; args?: unknown };
}

interface XdConsensusRunResult {
    run: XdConsensusRun;
    status: 'fulfilled' | 'rejected';
    value?: string;
    reason?: unknown;
    parsedAnswer?: string | null;
    isMajority?: boolean;
    _normalizedAnswer?: string;
}

interface XdConsensusResult {
    state: 'unanimous' | 'majority' | 'no-consensus';
    majorityAnswer: string | null;
    agreement: number;
    runResults: XdConsensusRunResult[];
}

interface XdMakeRequestOptions {
    url: string;
    method?: string;
    headers?: Record<string, string>;
    data?: unknown;
    responseType?: string;
    timeout?: number;
    [key: string]: unknown;
}

interface XdStreamRequestOptions {
    url: string;
    method?: string;
    headers?: Record<string, string>;
    data?: unknown;
    [key: string]: unknown;
}

/** Result resolved by `makeRequest` / `streamRequest` transports. */
interface XdTransportResult {
    success: true;
    data: string;
    [key: string]: unknown;
}

interface XdHelperState {
    width: string;
    height: string;
    maxHeight: string;
    bottom?: string;
    right?: string;
    top?: string;
    left?: string;
}

interface XdPositionPreset {
    top?: string;
    left?: string;
    right?: string;
    bottom?: string;
    /** Axis to translate by 50% to keep the preset visually centered. */
    translate?: 'x' | 'y' | 'xy';
}

interface XdMathEvalResult {
    success: boolean;
    error?: string;
    expression?: string;
    converted?: string;
    result?: string | number;
    formatted?: string;
    equation?: boolean;
    variable?: string;
    solutions?: number[];
}

interface XdAnswersInternal {
    // Constants and defaults
    DEFAULT_SETTINGS: XdSettings;
    defaultHelperState: XdHelperState;
    maximizedHelperState: XdHelperState;
    DEFAULT_SYSTEM_PROMPT: string;
    ANSWER_ONLY_SYSTEM_PROMPT: string;
    DEFAULT_BASE_URLS: Record<string, string>;
    API_FORMAT_MAP: Record<string, string>;
    TRANSLATIONS: Record<string, Record<string, string>>;

    // Settings and version helpers
    getActiveProvider(s: XdSettings): XdProviderConfig | null;
    getEffectiveSettings(s: XdSettings): XdEffectiveSettings;
    getEffectiveSettingsForRun(s: XdSettings, run: XdConsensusRun): XdEffectiveSettings;
    getVersionString(): string;
    resolvePositionPreset(preset: string): XdPositionPreset;

    // Markdown
    escapeHTML(value: unknown): string;

    // Consensus
    computeConsensus(runResults: unknown[]): XdConsensusResult;
    runConsensus(questionData: XdQuestionData): Promise<XdConsensusResult | null>;

    // Web search
    getActiveSearchProvider(s: XdSettings): XdProviderConfig | null;
    getEligibleProviders(s: XdSettings): XdProviderConfig[];
    buildWebSearchTool(apiFormat: string): unknown[];
    executeSearch(query: string, count?: number, preferredSource?: string): Promise<string>;

    // Calculator
    evaluateMath(rawExpression: string): XdMathEvalResult;
    latexToMath(latex: string): string;
    buildCalculatorTool(apiFormat: string): unknown[];
    buildTools(s: XdEffectiveSettings, apiFormat: string): unknown[];
    executeCalculator(rawExpression: string): string;
    isCalculatorToolName(name: string): boolean;

    // Request building
    buildMessages(questionData: XdQuestionData, showAnswerOnlyOverride?: boolean): { systemPrompt: string; userMsg: string };
    buildStreamUrl(s: XdEffectiveSettings): string;
    buildNonStreamUrl(s: XdEffectiveSettings): string;
    buildHeaders(s: XdEffectiveSettings): Record<string, string>;
    buildRequestBody(s: XdEffectiveSettings, systemPrompt: string, userMsg: string, images: Array<string | null>, stream: boolean): unknown;

    // Streaming and parsing
    parseSSEChunks(rawText: string, apiFormat: string): XdSseEvent[];
    parsePartialLabeled(text: string): XdParsedResponse | null;
    renderPartial(parsed: XdParsedResponse): string;
    formatError(msg: string): string;
    normalizeFieldName(name: string): string | null;
    parseLabeledResponse(text: string): XdParsedResponse | null;
    extractJSONString(text: string): string;
    extractFieldValue(text: string, fieldName: string): string;
    salvagePartialJSON(text: string): XdParsedResponse | null;
    parseAIResponse(text: string): XdParsedResponse;
    renderParsedResponse(parsed: XdParsedResponse): string;

    // DOM matching / grids
    findOptionElements(): Element[];
    normalizeText(t: unknown): string;
    levenshtein(a: string, b: string): number;
    textSimilarity(a: string, b: string): number;
    matchAnswerToOptions(answerText: string, optionElements: Element[]): Element[];
    isGridCell(el: Element): boolean;
    gridRowLabel(el: Element): string;
    gridCellColumnText(el: Element): string;
    collectGridRows(elements: Element[]): unknown[];
    matchGridAnswer(answerText: string, optionElements: Element[]): Element[];

    // Silent mode / selection / one-click
    toggleThinkingContent(headerEl: Element): void;
    addSilentExitButton(): void;
    applySilentMode(answerText: string, parsed: XdParsedResponse): void;
    highlightCorrectAnswer(answerText: string): void;
    formatDateForMSForms(text: string): string;
    autoSelectAnswer(answerText: string, force?: boolean): void;
    clearOneClickHandlers(): void;
}

interface XdAnswers {
    /** Build stamp injected into `version.js` (`v5.6.1` or a git hash). */
    _buildVersion: string;

    /** Factory copy of the defaults; all reads go through `_internal.DEFAULT_SETTINGS`. */
    DEFAULT_SETTINGS: XdSettings;
    settings: XdSettings;
    isProcessingAI: boolean;
    helperContainer: HTMLElement | null;
    answerContentDiv: HTMLElement | null;
    dragHeader: HTMLElement | null;
    isHelperWindowMaximized: boolean;
    isManuallyPositioned: boolean;
    /** Last parent the helper was appended to (write-only in current code). */
    currentHelperParentNode: Node | null;
    isExtensionModifyingDOM: boolean;
    /** Last HTTP request body (debug leftover, write-only). */
    lastRequestBody: unknown | null;
    lastParsedResponse: XdParsedResponse | null;
    onRefresh: (() => void) | null;
    _cancelStream: (() => void) | null;
    _originalTitle: string | null;
    _customAutoAnswer: ((answerText: string, parsed: XdParsedResponse) => void) | null;
    _oneClickUserTriggered: boolean;
    _oneClickContainer: HTMLElement | null;

    // Lazily created by their owning modules; `undefined` before first write.
    _autoSelecting?: boolean;
    _answerContainer?: HTMLElement | null;
    _statusInterval?: number | null;
    _thinkingExpanded?: boolean;

    Draggable: {
        init(container: HTMLElement, handle: HTMLElement, onDragStartCallback?: () => void): void;
        destroy(): void;
    };

    clearOneClickHandlers(): void;
    setupOneClickHandler(container: HTMLElement, getQuestionDataFn: () => XdQuestionData | Promise<XdQuestionData>, setCursor?: boolean): void;
    triggerHotkey(): Promise<void>;

    makeRequest(options: XdMakeRequestOptions): Promise<XdTransportResult>;
    streamRequest(
        options: XdStreamRequestOptions,
        onChunk: (chunk: unknown) => void,
        onDone: (result?: unknown) => void,
        onError: (error: unknown, details?: unknown) => void
    ): () => void;
    addStyle(css: string): void;
    imageToBase64(url: string): Promise<string | null>;

    loadSettings(): Promise<XdSettings>;
    renderMarkdown(text: string): string;
    resolvePositionPreset(preset: string): XdPositionPreset;

    getAnswer(questionData: XdQuestionData, effectiveSettingsOverride?: XdEffectiveSettings, showAnswerOnlyOverride?: boolean): Promise<string>;
    streamAnswer(questionData: XdQuestionData, outerStartTime?: number, overrides?: unknown): Promise<unknown>;
    processQuestion(questionData: XdQuestionData): Promise<void>;

    createUI(): void;
    attachHelperEventListeners(): void;
    attachAndPositionHelper(targetContainerOverride?: HTMLElement | null): void;
    updateHelperBaseStyles(): void;

    _internal: XdAnswersInternal;
}

interface Window {
    xdAnswers: XdAnswers;
}
