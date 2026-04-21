(function() {
    'use strict';

    window.xdAnswers = window.xdAnswers || {};
    window.xdAnswers._internal = window.xdAnswers._internal || {};

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
})();
