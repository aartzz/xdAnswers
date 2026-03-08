(function() {
    'use strict';
    const waitForUtils = setInterval(async () => {
        if (window.xdAnswers && window.xdAnswers.loadSettings) {
            clearInterval(waitForUtils);
            await window.xdAnswers.loadSettings();
            initVseosvita();
        }
    }, 50);

    function initVseosvita() {
        let lastProcessedKey = "";
        let debounceTimer = null;

        window.xdAnswers.onRefresh = () => {
            lastProcessedKey = "";
            checkQuestion(true);
        };

        function getText(el) {
            return (el?.innerText || el?.textContent || '').replace(/\s+/g, ' ').trim();
        }

        function collectMatchingOptions(questionRoot) {
            const wrapper = questionRoot.querySelector('.v-block-answers-cross-wrapper');
            if (!wrapper) return [];

            const items = [];
            const seen = new Set();

            wrapper.querySelectorAll('.v-block-answers-cross-block').forEach(block => {
                const key = getText(block.querySelector('.numb-item'));
                const value = getText(block.querySelector('.n-kahoot-p, p'));
                const combined = key && value ? `${key}. ${value}` : value || key;
                if (!combined || seen.has(combined)) return;
                seen.add(combined);
                items.push({ key, combined });
            });

            const numericItems = items
                .filter(item => /^\d+$/.test(item.key))
                .sort((a, b) => Number(a.key) - Number(b.key))
                .map(item => item.combined);

            const alphaItems = items
                .filter(item => item.key && !/^\d+$/.test(item.key))
                .sort((a, b) => a.key.localeCompare(b.key, 'uk'))
                .map(item => item.combined);

            const otherItems = items
                .filter(item => !item.key)
                .map(item => item.combined)
                .sort((a, b) => a.localeCompare(b, 'uk'));

            return [...numericItems, ...alphaItems, ...otherItems];
        }

        function collectOptions(questionRoot) {
            const matchingOptions = collectMatchingOptions(questionRoot);
            if (matchingOptions.length) return matchingOptions;

            const optionSelectors = [
                '.answer-text',
                '.v-test-questions-select-block .t-text-guest',
                '.v-test-questions-select-block .t-text',
                '.t-test-questions .t-text-guest',
                '.t-test-questions .t-text',
                '.test-answer',
                'label[for]'
            ];

            const seen = new Set();
            const options = [];
            for (const selector of optionSelectors) {
                questionRoot.querySelectorAll(selector).forEach(el => {
                    const text = getText(el);
                    if (!text) return;
                    if (seen.has(text)) return;
                    seen.add(text);
                    options.push(text);
                });
            }

            if (options.length === 0) {
                const choiceBlocks = questionRoot.querySelectorAll('input[type="radio"], input[type="checkbox"]');
                choiceBlocks.forEach(input => {
                    const wrap = input.closest('label, .answer-item, .v-test-questions-select-block, .test-answer') || input.parentElement;
                    const text = getText(wrap).replace(/^[A-ZА-ЯІЇЄҐ]\s*[\)\.]\s*/i, '').trim();
                    if (text && !seen.has(text)) {
                        seen.add(text);
                        options.push(text);
                    }
                });
            }

            return options;
        }

        function detectQuestionData() {
            const questionRoot = document.querySelector('#i-test-question-uwj219, .v-test-question, .v-test-go-bg, .test-question-text, .vseosvita-test-content');
            if (!questionRoot) return null;

            const titleNode = questionRoot.querySelector('.v-test-questions-title .content-box, .v-test-questions-title, .test-question-text, .question-text');
            const text = getText(titleNode || questionRoot);
            if (!text) return null;

            const options = collectOptions(questionRoot);
            const imgs = Array.from(questionRoot.querySelectorAll('img')).map(img => img.src).filter(Boolean);

            let questionType = 'unknown';
            if (questionRoot.querySelector('.row_draggable-question, .draggable-question-box')) {
                questionType = 'ordering';
            } else if (questionRoot.querySelector('input[type="checkbox"]')) {
                questionType = 'quiz';
            } else if (questionRoot.querySelector('input[type="radio"]')) {
                questionType = 'quiz';
            } else if (questionRoot.querySelector('.matching-question, .matching-block, .v-block-answers-cross-wrapper')) {
                questionType = 'matching';
            }

            return {
                root: questionRoot,
                text,
                options,
                optionsText: options.join('\n'),
                base64ImageSources: imgs,
                questionType,
                isMultiQuiz: questionRoot.querySelector('input[type="checkbox"]') !== null
            };
        }

        function checkQuestion(force = false) {
            if (window.xdAnswers.isProcessingAI && !force) return;
            const questionData = detectQuestionData();
            if (!questionData) return;

            const keyOptions = ['ordering', 'matching'].includes(questionData.questionType)
                ? [...questionData.options].sort((a, b) => a.localeCompare(b, 'uk'))
                : questionData.options;

            const currentKey = JSON.stringify({
                text: questionData.text,
                options: keyOptions,
                type: questionData.questionType,
                images: questionData.base64ImageSources
            });

            if (!force && currentKey === lastProcessedKey) return;
            lastProcessedKey = currentKey;

            const imgPromises = questionData.base64ImageSources.map(src => window.xdAnswers.imageToBase64(src));
            Promise.all(imgPromises).then(images => {
                window.xdAnswers.processQuestion({
                    text: questionData.text,
                    optionsText: questionData.optionsText,
                    base64Images: images.filter(Boolean),
                    questionType: questionData.questionType,
                    isMultiQuiz: questionData.isMultiQuiz
                });
                window.xdAnswers.attachAndPositionHelper();
            });
        }

        const observer = new MutationObserver(() => {
            if (window.xdAnswers.isExtensionModifyingDOM) return;
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => checkQuestion(false), 250);
            window.xdAnswers.attachAndPositionHelper();
        });

        observer.observe(document.body, { childList: true, subtree: true, characterData: true });
        checkQuestion();
    }
})();
