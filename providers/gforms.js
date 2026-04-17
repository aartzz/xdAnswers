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
            const isOneClick = window.xdAnswers.settings.silentMode === 'oneclick';

            questionContainers.forEach((container, index) => {
                // Always add Solve button as fallback
                if (!container.querySelector('.xd-solve-btn')) {
                    const button = document.createElement('button');
                    button.className = 'xd-btn xd-solve-btn';
                    button.innerText = '✨ Solve';
                    button.style.cssText = `background:rgba(99,102,241,0.1);border:1px solid rgba(99,102,241,0.5);color:#6366f1;padding:6px 14px;border-radius:6px;cursor:pointer;margin-top:10px;font-family:system-ui,-apple-system,sans-serif;font-weight:600;font-size:13px;z-index:9999;position:relative;transition:all 0.15s;`;
                    button.onclick = (e) => {
                        e.preventDefault(); e.stopPropagation();
                        const titleEl = container.querySelector('.M7eMe, .GEHe6, [role="heading"]');
                        const questionText = (titleEl ? titleEl.innerText : container.innerText).trim();
                        const optionLabels = container.querySelectorAll('[role="radio"], [role="checkbox"], [role="option"]');
                        const options = Array.from(optionLabels).map(el => el.innerText.trim()).filter(Boolean);
                        const optionsText = options.join('\n');
                        optionLabels.forEach(el => el.setAttribute('data-xd-option', 'true'));
                        const imgPromises = [];
                        container.querySelectorAll('img').forEach(img => {
                             if (img.width > 50 && img.height > 50) imgPromises.push(window.xdAnswers.imageToBase64(img.src));
                        });
                        Promise.all(imgPromises).then(images => {
                             window.xdAnswers.processQuestion({
                                 text: questionText,
                                 optionsText: optionsText || undefined,
                                 base64Images: images.filter(i => i !== null),
                                 questionType: options.length > 0 ? 'quiz' : 'general'
                             });
                        });
                    };
                    container.appendChild(button);
                }

                // In oneclick mode, also register click handler on question container
                if (isOneClick && !container.classList.contains('xd-oneclick-ready')) {
                    window.xdAnswers.setupOneClickHandler(container, async () => {
                        const titleEl = container.querySelector('.M7eMe, .GEHe6, [role="heading"]');
                        const questionText = (titleEl ? titleEl.innerText : container.innerText).trim();
                        const optionLabels = container.querySelectorAll('[role="radio"], [role="checkbox"], [role="option"]');
                        const options = Array.from(optionLabels).map(el => el.innerText.trim()).filter(Boolean);
                        optionLabels.forEach(el => el.setAttribute('data-xd-option', 'true'));
                        const imgPromises = [];
                        container.querySelectorAll('img').forEach(img => {
                            if (img.width > 50 && img.height > 50) imgPromises.push(window.xdAnswers.imageToBase64(img.src));
                        });
                        const images = await Promise.all(imgPromises);
                        return {
                            text: questionText,
                            optionsText: options.join('\n') || undefined,
                            base64Images: images.filter(i => i !== null),
                            questionType: options.length > 0 ? 'quiz' : 'general'
                        };
                    });
                }
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