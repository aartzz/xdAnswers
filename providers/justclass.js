(function() {
    'use strict';
    let justClassApiCache = null;
    let justClassHash = null;

    const waitForUtils = setInterval(async () => {
        if (window.xdAnswers && window.xdAnswers.loadSettings) {
            clearInterval(waitForUtils);
            await window.xdAnswers.loadSettings();
            initJustClass();
        }
    }, 50);

    function initJustClass() {
        let lastProcessedText = "";
        window.xdAnswers.onRefresh = () => { lastProcessedText = ""; checkQuestion(); };

        setInterval(() => {
             const match = location.href.match(/hw\/([a-zA-Z0-9]+)/);
             const currentHash = match ? match[1] : null;
             if (currentHash && currentHash !== justClassHash) {
                 justClassApiCache = null; justClassHash = currentHash;
             }
        }, 1000);

        function checkQuestion() {
            if (window.xdAnswers.isProcessingAI) return;
            
            // Batch mode: collect ALL questions on the page
            const allQuestions = document.querySelectorAll('.justkids-text, .question-text, [data-question-id] .question-content');
            
            if (allQuestions.length === 0) return;
            
            // Single question mode (backward compatible)
            if (allQuestions.length === 1) {
                processSingleQuestion(allQuestions[0]);
                return;
            }
            
            // Batch mode: multiple questions
            processBatchQuestions(Array.from(allQuestions));
        }
        
        function extractOptions(questionEl) {
            const options = [];
            // Try common justclass option selectors
            const optionEls = questionEl.querySelectorAll('.justkids-answer-text, .answer-option, .option-text, .answer-btn');
            if (optionEls.length > 0) {
                optionEls.forEach((el, idx) => {
                    const text = el.innerText.trim();
                    if (text) options.push(String.fromCharCode(65 + idx) + ': ' + text);
                });
            }
            // Fallback: look for buttons with text
            if (options.length === 0) {
                const btnEls = questionEl.querySelectorAll('button');
                btnEls.forEach((btn, idx) => {
                    const text = btn.innerText.trim();
                    if (text && text.length < 200) { // Not a large text block
                        options.push(String.fromCharCode(65 + idx) + ': ' + text);
                    }
                });
            }
            return options;
        }
        
        function extractImages(questionEl) {
            const images = [];
            questionEl.querySelectorAll('img').forEach(img => {
                if (img.src && !img.src.startsWith('data:') && img.width > 30) {
                    images.push(img.src);
                }
            });
            // Also check for background images
            questionEl.querySelectorAll('[style*="background-image"]').forEach(el => {
                const match = el.style.backgroundImage.match(/url\(["']?([^"')]+)["']?\)/);
                if (match && match[1]) images.push(match[1]);
            });
            return images;
        }
        
        function processSingleQuestion(textEl) {
            const currentText = textEl.innerText.trim();
            if (!currentText || currentText === lastProcessedText) return;
            lastProcessedText = currentText;
            
            const container = textEl.closest('.question-container') || textEl.parentElement;
            const options = extractOptions(container || textEl);
            const images = extractImages(container || textEl);
            
            const isOneClick = window.xdAnswers.settings.silentMode === 'oneclick';
            
            if (isOneClick) {
                if (container && !container.classList.contains('xd-oneclick-ready')) {
                    window.xdAnswers.clearOneClickHandlers();
                    const savedText = currentText;
                    const savedOptions = options;
                    const savedImages = images;
                    window.xdAnswers.setupOneClickHandler(container, async () => {
                        const imgB64 = await Promise.all(savedImages.map(src => window.xdAnswers.imageToBase64(src)));
                        return {
                            text: savedText,
                            optionsText: savedOptions.join('\n') || undefined,
                            base64Images: imgB64.filter(Boolean),
                            questionType: options.length > 0 ? 'quiz' : 'unknown'
                        };
                    });
                }
            } else {
                const questionData = {
                    text: currentText,
                    optionsText: options.join('\n') || undefined,
                    base64Images: [],
                    questionType: options.length > 0 ? 'quiz' : 'unknown'
                };
                Promise.all(images.map(src => window.xdAnswers.imageToBase64(src))).then(imgs => {
                    questionData.base64Images = imgs.filter(Boolean);
                    window.xdAnswers.processQuestion(questionData);
                });
            }
        }
        
        async function processBatchQuestions(questionEls) {
            // Build batch data
            const batchQuestions = [];
            for (const qEl of questionEls) {
                const text = qEl.innerText.trim();
                if (!text) continue;
                const container = qEl.closest('.question-container') || qEl.parentElement;
                const options = extractOptions(container || qEl);
                const images = extractImages(container || qEl);
                const imgB64 = await Promise.all(images.map(src => window.xdAnswers.imageToBase64(src)));
                batchQuestions.push({
                    text,
                    optionsText: options.join('\n') || undefined,
                    base64Images: imgB64.filter(Boolean),
                    questionType: options.length > 0 ? 'quiz' : 'unknown'
                });
            }
            
            if (batchQuestions.length === 0) return;
            
            // Create combined text for batch
            const combinedText = batchQuestions.map((q, i) => 
                `Питання ${i + 1}:\n${q.text}${q.optionsText ? '\nВаріанти:\n' + q.optionsText : ''}`
            ).join('\n\n---\n\n');
            
            // Combine all images
            const allImages = batchQuestions.flatMap(q => q.base64Images);
            
            const currentKey = combinedText + '|' + allImages.join(',');
            if (currentKey === lastProcessedText) return;
            lastProcessedText = currentKey;
            
            const isOneClick = window.xdAnswers.settings.silentMode === 'oneclick';
            
            if (isOneClick) {
                const container = questionEls[0].closest('.questions-wrapper') || document.body;
                if (!container.classList.contains('xd-oneclick-ready')) {
                    window.xdAnswers.clearOneClickHandlers();
                    window.xdAnswers.setupOneClickHandler(container, async () => ({
                        text: 'Це багатопитанний тест. Відповідай на кожне питання окремо.\n\n' + combinedText,
                        base64Images: allImages,
                        questionType: 'batch',
                        batchQuestions: batchQuestions
                    }));
                }
            } else {
                const questionData = {
                    text: 'Це багатопитанний тест. Відповідай на кожне питання окремо.\n\n' + combinedText,
                    base64Images: allImages,
                    questionType: 'batch',
                    batchQuestions: batchQuestions
                };
                window.xdAnswers.processQuestion(questionData);
            }
        }
        const observer = new MutationObserver(() => {
            checkQuestion();
            // Only re-attach if container was removed from DOM;
            // do NOT call attachAndPositionHelper unconditionally — it clears transform
            // and resets position, which breaks dragging during AI processing.
            if (window.xdAnswers.helperContainer && !window.xdAnswers.helperContainer.parentNode) {
                window.xdAnswers.attachAndPositionHelper();
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
        checkQuestion();
    }
})();