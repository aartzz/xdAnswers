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
            const textEl = document.querySelector('.justkids-text'); 
            if (textEl) {
                const currentText = textEl.innerText;
                if (currentText !== lastProcessedText) {
                    lastProcessedText = currentText;
                    const isOneClick = window.xdAnswers.settings.silentMode === 'oneclick';
                    const container = textEl.closest('.question-container') || textEl.parentElement;

                    if (isOneClick) {
                        // One-click mode: register click handler instead of auto-processing
                        if (container && !container.querySelector('.xd-indicator-dot')) {
                            window.xdAnswers.clearOneClickHandlers();
                            const savedText = currentText;
                            const savedContainer = container;
                            window.xdAnswers.setupOneClickHandler(container, async () => {
                                const imgPromises = [];
                                savedContainer.querySelectorAll('img').forEach(img => imgPromises.push(window.xdAnswers.imageToBase64(img.src)));
                                const images = await Promise.all(imgPromises);
                                return {
                                    text: savedText,
                                    base64Images: images.filter(img => img !== null),
                                    questionType: 'unknown'
                                };
                            });
                        }
                    } else {
                        // Normal: auto-process
                        const questionData = { text: currentText, base64Images: [], questionType: 'unknown' };
                        const imgPromises = [];
                        if (container) container.querySelectorAll('img').forEach(img => imgPromises.push(window.xdAnswers.imageToBase64(img.src)));
                        
                        Promise.all(imgPromises).then(images => {
                            questionData.base64Images = images.filter(img => img !== null);
                            window.xdAnswers.processQuestion(questionData);
                        });
                    }
                }
            }
        }
        const observer = new MutationObserver(() => {
            checkQuestion(); window.xdAnswers.attachAndPositionHelper();
        });
        observer.observe(document.body, { childList: true, subtree: true });
        checkQuestion();
    }
})();