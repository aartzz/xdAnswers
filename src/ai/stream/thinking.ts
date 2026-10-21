// src/ai/stream/thinking.ts
// Prose patterns that mark reasoning text leaking into the answer stream.
(function() {
    'use strict';
    window.xdAnswers = window.xdAnswers || ({} as XdAnswers);
    window.xdAnswers._internal = window.xdAnswers._internal || ({} as XdAnswersInternal);

    const I = window.xdAnswers._internal;

    I.PROSE_THINKING_ANYWHERE_REGEX = /(?:^|\n)\s*(?:Here's a thinking process|Thinking Process:|Thinking:|The user (?:is asking|asks|wants|is trying)|I need to (?:select|choose|find|determine|identify)|Let's think|First, let's|Let's analyze|We need to (?:answer|find|determine|identify|select|choose))/i;
    I.PROSE_TRANSITION_REGEX = /\n(?:\s*---|(?:\*{0,2}(?:Answer|Final Answer|Correct Answer|Відповідь|Ответ|Summary)\*{0,2}\s*:)|(?:\{[\s\r\n]*"answer")|(?:\*{0,2}(?:Therefore|Thus|So),?\s*(?:the\s+)?(?:correct\s+)?(?:answer|option)\s+(?:is|=)\*{0,2}\s*:?)|(?:Conclusion\s*:)|(?:The\s+correct\s+option\s+is\s*:?))/i;

    I.extractInlineThinking = function(
        st: { rawContentBuffer: string; inInlineThinking: boolean; fullContent: string; fullThinking: string; thinkingStarted: boolean; thinkingDone: boolean },
        newText: string,
        ensureThinkingUI: () => void,
        updateStreamUI: () => void
    ): void {
        st.rawContentBuffer += newText;

        if (!st.inInlineThinking && st.rawContentBuffer.includes('<think>')) {
            const parts = st.rawContentBuffer.split('<think>');
            const before = parts[0];
            st.rawContentBuffer = '<think>' + parts.slice(1).join('<think>');
            st.inInlineThinking = true;
            ensureThinkingUI();
            if (before) st.fullContent += before;
        }

        if (!st.inInlineThinking) {
            if (st.fullContent.length === 0 && st.rawContentBuffer.length < 30) {
                const prefix = st.rawContentBuffer.trimStart();
                const possiblePrefixes = ["here", "thinking", "the", "i need", "let", "first", "we need"];
                if (possiblePrefixes.some(p => p.startsWith(prefix.toLowerCase()) || prefix.toLowerCase().startsWith(p))) {
                    return;
                }
            }

            const anywhereMatch = st.rawContentBuffer.match(I.PROSE_THINKING_ANYWHERE_REGEX);
            if (anywhereMatch) {
                const matchIndex = anywhereMatch.index ?? 0;
                const before = st.rawContentBuffer.slice(0, matchIndex);
                st.rawContentBuffer = st.rawContentBuffer.slice(matchIndex).replace(/^\n\s*/, '');
                st.inInlineThinking = true;
                ensureThinkingUI();
                if (before) st.fullContent += before;
            }
        }

        if (st.inInlineThinking) {
            const closeIndex = st.rawContentBuffer.indexOf('</think>');
            if (closeIndex !== -1) {
                const thinkPart = st.rawContentBuffer.slice(0, closeIndex).replace(/^<think>/i, '');
                st.fullThinking = thinkPart;
                st.rawContentBuffer = st.rawContentBuffer.slice(closeIndex + 8);
                st.inInlineThinking = false;
                st.thinkingDone = true;
                if (st.rawContentBuffer) {
                    st.fullContent += st.rawContentBuffer;
                    st.rawContentBuffer = '';
                }
            } else if (!st.rawContentBuffer.startsWith('<think>')) {
                const transitionMatch = st.rawContentBuffer.search(I.PROSE_TRANSITION_REGEX);
                if (transitionMatch !== -1) {
                    const thinkPart = st.rawContentBuffer.slice(0, transitionMatch);
                    st.fullThinking = thinkPart;
                    st.rawContentBuffer = st.rawContentBuffer.slice(transitionMatch + 1);
                    st.inInlineThinking = false;
                    st.thinkingDone = true;
                    if (st.rawContentBuffer) {
                        st.fullContent += st.rawContentBuffer;
                        st.rawContentBuffer = '';
                    }
                } else {
                    st.fullThinking = st.rawContentBuffer;
                }
            } else {
                st.fullThinking = st.rawContentBuffer.replace(/^<think>/i, '');
            }

            if (st.fullThinking) ensureThinkingUI();
            updateStreamUI();
            return;
        }

        if (st.thinkingStarted && !st.thinkingDone) st.thinkingDone = true;
        st.fullContent += st.rawContentBuffer;
        st.rawContentBuffer = '';
        updateStreamUI();
    };
})();
