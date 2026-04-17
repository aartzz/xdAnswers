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

        // Mark option elements with data-xd-option so findOptionElements()/matchAnswerToOptions()
        // in utils.js can find them for auto-answer and indicator modes
        function markOptionElements(questionRoot) {
            // For radio/checkbox questions: mark the label[for] elements
            questionRoot.querySelectorAll('.v-test-questions-radio-block label[for], .v-test-questions-checkbox-block label[for]').forEach(label => {
                label.setAttribute('data-xd-option', 'true');
            });
            // For matching questions: mark cross-block items
            questionRoot.querySelectorAll('.v-block-answers-cross-block').forEach(block => {
                const textEl = block.querySelector('.n-kahoot-p, p') || block;
                textEl.setAttribute('data-xd-option', 'true');
            });
            // Fallback: mark generic option elements
            questionRoot.querySelectorAll('.v-test-questions-select-block .t-text, .v-test-questions-select-block .t-text-guest, .answer-text, .test-answer').forEach(el => {
                el.setAttribute('data-xd-option', 'true');
            });
        }

        function detectQuestionData() {
            const questionRoot = document.querySelector('#i-test-question-uwj219, .v-test-question, .v-test-go-bg, .test-question-text, .vseosvita-test-content');
            if (!questionRoot) return null;

            const titleNode = questionRoot.querySelector('.v-test-questions-title .content-box, .v-test-questions-title, .test-question-text, .question-text');
            const text = getText(titleNode || questionRoot);
            if (!text) return null;

            // Mark option elements for auto-answer/indicators
            markOptionElements(questionRoot);

            const options = collectOptions(questionRoot);

            // Collect images from question title first, then from the rest of the question
            const titleImgs = Array.from(
                (titleNode || questionRoot).querySelectorAll('img')
            ).map(img => img.src || img.getAttribute('data-src')).filter(Boolean);
            const otherImgs = Array.from(
                questionRoot.querySelectorAll('img')
            ).map(img => img.src || img.getAttribute('data-src')).filter(Boolean);
            const imgs = [...new Set([...titleImgs, ...otherImgs])];

            // Detect question type
            const hasTextInput = questionRoot.querySelector('.a-test-lab-inp input[type="text"]') !== null;
            const hasCheckbox = questionRoot.querySelector('input[type="checkbox"]') !== null;
            const hasRadio = questionRoot.querySelector('input[type="radio"]') !== null;
            const hasMatching = questionRoot.querySelector('.matching-question, .matching-block, .v-block-answers-cross-wrapper') !== null;
            const hasOrdering = questionRoot.querySelector('.row_draggable-question, .draggable-question-box') !== null;

            let questionType = 'unknown';
            let isMultiQuiz = false;

            if (hasOrdering) {
                questionType = 'ordering';
            } else if (hasMatching) {
                questionType = 'matching';
            } else if (hasTextInput) {
                questionType = 'short_text';
            } else if (hasCheckbox) {
                questionType = 'quiz';
                isMultiQuiz = true;
            } else if (hasRadio) {
                questionType = 'quiz';
            }

            return {
                root: questionRoot,
                text,
                options,
                optionsText: options.join('\n') || undefined,
                base64ImageSources: imgs,
                questionType,
                isMultiQuiz,
                isMulti: isMultiQuiz
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

            const isOneClick = window.xdAnswers.settings.silentMode === 'oneclick';

            if (isOneClick) {
                // One-click mode: register click handler instead of auto-processing
                // Vseosvita reuses the same container DOM element for each question,
                // so we must always re-register when the question key changes
                const container = questionData.root;
                if (container) {
                    window.xdAnswers.clearOneClickHandlers();
                    // Capture current question data for click-time processing
                    const savedText = questionData.text;
                    const savedOptionsText = questionData.optionsText;
                    const savedImageUrls = questionData.base64ImageSources;
                    const savedQuestionType = questionData.questionType;
                    const savedIsMultiQuiz = questionData.isMultiQuiz;
                    const savedIsMulti = questionData.isMulti;
                    window.xdAnswers.setupOneClickHandler(container, async () => {
                        // Re-mark options in case DOM changed since last detection
                        markOptionElements(container);
                        const images = await Promise.all(savedImageUrls.map(src => window.xdAnswers.imageToBase64(src)));
                        return {
                            text: savedText,
                            optionsText: savedOptionsText,
                            base64Images: images.filter(Boolean),
                            questionType: savedQuestionType,
                            isMultiQuiz: savedIsMultiQuiz,
                            isMulti: savedIsMulti
                        };
                    });
                }
                window.xdAnswers.attachAndPositionHelper();
            } else {
                // Normal: auto-process
                const imgPromises = questionData.base64ImageSources.map(src => window.xdAnswers.imageToBase64(src));
                Promise.all(imgPromises).then(images => {
                    window.xdAnswers.processQuestion({
                        text: questionData.text,
                        optionsText: questionData.optionsText,
                        base64Images: images.filter(Boolean),
                        questionType: questionData.questionType,
                        isMultiQuiz: questionData.isMultiQuiz,
                        isMulti: questionData.isMulti
                    });
                    window.xdAnswers.attachAndPositionHelper();
                });
            }
        }

        const observer = new MutationObserver(() => {
            if (window.xdAnswers.isExtensionModifyingDOM) return;
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => checkQuestion(false), 250);
            window.xdAnswers.attachAndPositionHelper();
        });

        observer.observe(document.body, { childList: true, subtree: true, characterData: true });
        checkQuestion();

        // Polling fallback: vseosvita reuses the same container DOM element (Vue),
        // so MutationObserver may miss subtle question transitions.
        // This ensures new questions are detected within 1 second max.
        setInterval(() => checkQuestion(false), 1000);
    }
})();
