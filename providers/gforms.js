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
                // Mark option text elements so findOptionElements can find them
                const optionLabels = container.querySelectorAll('[role="radio"], [role="checkbox"], [role="option"]');
                optionLabels.forEach(el => {
                    // Put data-xd-option on the .snByac span (which has the actual text),
                    // not the role=radio div (which has empty innerText)
                    const textSpan = el.querySelector('.snByac') || el.closest('label')?.querySelector('.snByac');
                    if (textSpan) {
                        textSpan.setAttribute('data-xd-option', 'true');
                    } else {
                        el.setAttribute('data-xd-option', 'true');
                    }
                });

                if (isOneClick) {
                    // One-click mode: click on question triggers AI → auto-select
                    if (container.classList.contains('xd-oneclick-ready')) return;
                    window.xdAnswers.setupOneClickHandler(container, async () => {
                        const titleEl = container.querySelector('.M7eMe, .GEHe6, [role="heading"]');
                        const questionText = (titleEl ? titleEl.innerText : container.innerText).trim();
                        const optionEls = container.querySelectorAll('[data-xd-option="true"]');
                        const options = Array.from(optionEls).map(el => el.innerText.trim()).filter(Boolean);
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
                } else {
                    // Normal mode: add Solve button
                    if (container.querySelector('.xd-solve-btn')) return;
                    const button = document.createElement('button');
                    button.className = 'xd-btn xd-solve-btn';
                    button.innerText = '✨ Solve';
                    button.style.cssText = `background:rgba(99,102,241,0.1);border:1px solid rgba(99,102,241,0.5);color:#6366f1;padding:6px 14px;border-radius:6px;cursor:pointer;margin-top:10px;font-family:system-ui,-apple-system,sans-serif;font-weight:600;font-size:13px;z-index:9999;position:relative;transition:all 0.15s;`;
                    button.onclick = (e) => {
                        e.preventDefault(); e.stopPropagation();
                        const titleEl = container.querySelector('.M7eMe, .GEHe6, [role="heading"]');
                        const questionText = (titleEl ? titleEl.innerText : container.innerText).trim();
                        const optionEls = container.querySelectorAll('[data-xd-option="true"]');
                        const options = Array.from(optionEls).map(el => el.innerText.trim()).filter(Boolean);
                        const optionsText = options.join('\n');
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