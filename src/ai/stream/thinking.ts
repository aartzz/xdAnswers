// src/ai/stream/thinking.ts
// Prose patterns that mark reasoning text leaking into the answer stream.
(function() {
    'use strict';
    window.xdAnswers = window.xdAnswers || ({} as XdAnswers);
    window.xdAnswers._internal = window.xdAnswers._internal || ({} as XdAnswersInternal);

    const I = window.xdAnswers._internal;

    I.PROSE_THINKING_ANYWHERE_REGEX = /(?:^|\n)\s*(?:Here's a thinking process|Thinking Process:|Thinking:|The user (?:is asking|asks|wants|is trying)|I need to (?:select|choose|find|determine|identify)|Let's think|First, let's|Let's analyze|We need to (?:answer|find|determine|identify|select|choose))/i;
    I.PROSE_TRANSITION_REGEX = /\n(?:\s*---|(?:\*{0,2}(?:Answer|Final Answer|Correct Answer|Відповідь|Ответ|Summary)\*{0,2}\s*:)|(?:\{[\s\r\n]*"answer")|(?:\*{0,2}(?:Therefore|Thus|So),?\s*(?:the\s+)?(?:correct\s+)?(?:answer|option)\s+(?:is|=)\*{0,2}\s*:?)|(?:Conclusion\s*:)|(?:The\s+correct\s+option\s+is\s*:?))/i;
})();
