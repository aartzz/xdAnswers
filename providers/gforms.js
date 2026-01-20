(function() {
    'use strict';
    const waitForUtils = setInterval(async () => {
        if (window.xdAnswers && window.xdAnswers.loadSettings) {
            clearInterval(waitForUtils);
            await window.xdAnswers.loadSettings();
            initGForms();
        }
    }, 50);

    function initGForms() {
        window.xdAnswers.onRefresh = () => console.log("Refreshed");
        chrome.runtime.onMessage.addListener((message) => {
            if (message.type === "gform_url_changed") setTimeout(scanAndInjectButtons, 1500);
        });

        function scanAndInjectButtons() {
            const questionContainers = document.querySelectorAll('.geS5n');
            questionContainers.forEach((container, index) => {
                if (container.querySelector('.xd-solve-btn')) return;

                const button = document.createElement('button');
                button.className = 'xd-btn xd-solve-btn';
                button.innerText = '✨ Solve';
                button.style.cssText = `background:transparent;border:1px solid #00ffff;color:#00ff9d;padding:5px 10px;border-radius:5px;cursor:pointer;margin-top:10px;font-family:'Courier New',monospace;font-weight:bold;z-index:9999;position:relative;`;
                
                button.onclick = (e) => {
                    e.preventDefault(); e.stopPropagation();
                    const questionText = container.innerText;
                    const imgPromises = [];
                    container.querySelectorAll('img').forEach(img => {
                         if (img.width > 50 && img.height > 50) imgPromises.push(window.xdAnswers.imageToBase64(img.src));
                    });
                    Promise.all(imgPromises).then(images => {
                         window.xdAnswers.processQuestion({
                             text: questionText, base64Images: images.filter(i => i !== null), questionType: 'general'
                         });
                    });
                };
                container.appendChild(button);
            });
        }
        const observer = new MutationObserver(() => {
            scanAndInjectButtons();
            if (window.xdAnswers.helperContainer && !document.body.contains(window.xdAnswers.helperContainer)) {
                 document.body.appendChild(window.xdAnswers.helperContainer);
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
        scanAndInjectButtons();
    }
})();