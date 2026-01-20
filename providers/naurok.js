(function() {
    'use strict';

    const waitForUtils = setInterval(async () => {
        if (window.xdAnswers && window.xdAnswers.loadSettings) {
            clearInterval(waitForUtils);
            await window.xdAnswers.loadSettings();
            initNaurok();
        }
    }, 50);

    function initNaurok() {
        let lastStateHash = "";
        let debounceTimer = null;

        window.xdAnswers.onRefresh = () => {
            lastStateHash = "";
            processDOM();
        };

        function processDOM() {
            // Використовуємо debounce, щоб не реагувати на кожну дрібну зміну під час рендеру Angular
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(checkQuestion, 300);
        }

        function checkQuestion() {
            if (window.xdAnswers.isProcessingAI) return;

            // 1. Отримуємо текст запитання (HTML показує, що він тут)
            const textContainer = document.querySelector('.test-content-text-inner');
            if (!textContainer) return;
            
            const questionText = textContainer.innerText.trim();
            if (!questionText) return; // Чекаємо, поки Angular вставить текст

            // 2. Отримуємо варіанти відповідей
            // HTML показує, що текст варіантів у .question-option-inner-content
            const optionElements = document.querySelectorAll('.question-option-inner-content');
            const optionsText = Array.from(optionElements).map(el => el.innerText.trim()).join('\n');

            // 3. Збираємо ТІЛЬКИ видимі картинки
            const validImages = [];
            const allImages = document.querySelectorAll('img');
            
            allImages.forEach(img => {
                // Перевірка: чи є src, чи не прихований (ng-hide) і чи достатній розмір
                const isHidden = img.classList.contains('ng-hide') || img.offsetParent === null;
                const hasSrc = img.src && img.src.length > 0 && !img.src.startsWith('data:image/gif'); // ігноруємо пусті gif
                
                // Перевіряємо, чи картинка належить до блоку тесту
                const isInTest = img.closest('.test-question-content') || img.closest('.test-question-options');

                if (!isHidden && hasSrc && isInTest && img.width > 40) {
                    validImages.push(img.src);
                }
            });

            // 4. Створюємо підпис стану (текст + варіанти + к-сть картинок)
            const currentStateHash = `${questionText}|${optionsText}|${validImages.length}`;

            if (currentStateHash !== lastStateHash) {
                console.log("xdAnswers: New question state detected:", currentStateHash);
                lastStateHash = currentStateHash;

                // Затримка, щоб переконатися, що картинки провантажились
                setTimeout(() => {
                    const questionData = {
                        text: questionText,
                        optionsText: optionsText,
                        base64Images: [],
                        questionType: 'quiz'
                    };

                    const imgPromises = validImages.map(src => window.xdAnswers.imageToBase64(src));

                    Promise.all(imgPromises).then(images => {
                        questionData.base64Images = images.filter(img => img !== null);
                        window.xdAnswers.processQuestion(questionData);
                    });
                }, 500); 
            }
        }

        // MutationObserver стежить за змінами в основному контейнері тесту
        const observer = new MutationObserver(() => {
            if (window.xdAnswers.isExtensionModifyingDOM) return;
            processDOM();
            window.xdAnswers.attachAndPositionHelper();
        });

        // Стежимо за body, бо Angular може перемальовувати великі шматки DOM
        observer.observe(document.body, { childList: true, subtree: true });
        
        // Первинний запуск
        processDOM();
    }
})();