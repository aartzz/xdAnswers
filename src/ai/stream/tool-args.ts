// src/ai/stream/tool-args.ts
// Argument extraction for streamed tool calls (calculator expression, search query).
(function() {
    'use strict';
    window.xdAnswers = window.xdAnswers || ({} as XdAnswers);
    window.xdAnswers._internal = window.xdAnswers._internal || ({} as XdAnswersInternal);

    const I = window.xdAnswers._internal;

    I.extractToolExpression = function(args: Record<string, any>): string {
        return args.expression || args.expr || args.formula || args.query || args.input || '';
    };

    I.extractToolQuery = function(args: Record<string, any>): string {
        return args.query || args.q || '';
    };
})();
