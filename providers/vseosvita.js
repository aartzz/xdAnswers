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
        window.xdAnswers.onRefresh = () => { lastProcessedKey = ""; checkQuestion(); };

        function checkQuestion() {
            if (window.xdAnswers.isProcessingAI) return;
            const questionElement = document.querySelector('.vseosvita-test-content') || document.querySelector('.test-question-text');
            if (questionElement) {
                const currentText = questionElement.innerText;
                const imgs = questionElement.querySelectorAll('img');
                const currentKey = currentText + "_" + imgs.length;

                if (currentKey !== lastProcessedKey) {
                    lastProcessedKey = currentKey;
                    const questionData = { text: currentText, base64Images: [], questionType: 'unknown' };
                    const imgPromises = [];
                    imgs.forEach(img => imgPromises.push(window.xdAnswers.imageToBase64(img.src)));

                    Promise.all(imgPromises).then(images => {
                        questionData.base64Images = images.filter(img => img !== null);
                        window.xdAnswers.processQuestion(questionData);
                        const fsContainer = document.querySelector('.full-screen-container');
                        if (fsContainer) window.xdAnswers.attachAndPositionHelper(fsContainer);
                    });
                }
            }
        }
        const observer = new MutationObserver(() => {
            if (window.xdAnswers.isExtensionModifyingDOM) return;
            checkQuestion();
            const fsContainer = document.querySelector('.full-screen-container');
            window.xdAnswers.attachAndPositionHelper(fsContainer);
        });
        observer.observe(document.body, { childList: true, subtree: true });
        checkQuestion();
    }
})();