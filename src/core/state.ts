(function() {
    'use strict';

    window.xdAnswers = window.xdAnswers || ({} as XdAnswers);
    window.xdAnswers._internal = window.xdAnswers._internal || ({} as XdAnswersInternal);

    const DEFAULT_SETTINGS = window.xdAnswers._internal.DEFAULT_SETTINGS;

    window.xdAnswers.DEFAULT_SETTINGS = DEFAULT_SETTINGS;
    window.xdAnswers.settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    window.xdAnswers.isProcessingAI = false;
    window.xdAnswers.helperContainer = null;
    window.xdAnswers.answerContentDiv = null;
    window.xdAnswers.dragHeader = null;
    window.xdAnswers.isHelperWindowMaximized = false;
    window.xdAnswers.isManuallyPositioned = false;
    window.xdAnswers.currentHelperParentNode = null;
    window.xdAnswers.isExtensionModifyingDOM = false;
    window.xdAnswers.lastRequestBody = null;
    window.xdAnswers.onRefresh = null;
    window.xdAnswers.lastParsedResponse = null;
    window.xdAnswers._cancelStream = null;
    window.xdAnswers._originalTitle = null;
    window.xdAnswers._customAutoAnswer = null;

    function genRandClass(): string {
        return '_' + Math.random().toString(36).slice(2, 8);
    }

    window.xdAnswers._internal.uiTokens = {
        panel: genRandClass(),
        bar: genRandClass(),
        dragBar: genRandClass(),
        title: genRandClass(),
        version: genRandClass(),
        actions: genRandClass(),
        btnSilent: genRandClass(),
        selSilent: genRandClass(),
        btnRefresh: genRandClass(),
        view: genRandClass(),
        answerView: genRandClass(),
        footer: genRandClass(),
        time: genRandClass(),
        model: genRandClass(),
        copy: genRandClass(),
        btnCopy: genRandClass(),
        icon: genRandClass(),
        spinner: genRandClass(),
        zIndex: Math.floor(Math.random() * (999999 - 10000 + 1)) + 10000
    };
    window.xdAnswers._internal.ui = {};
})();
