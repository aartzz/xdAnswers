// src/ai/request/messages.ts
// System prompt and user message construction for answer requests.
(function() {
    'use strict';
    window.xdAnswers = window.xdAnswers || ({} as XdAnswers);
    window.xdAnswers._internal = window.xdAnswers._internal || ({} as XdAnswersInternal);
    const I = window.xdAnswers._internal;

    function buildMessages(questionData: XdQuestionData, showAnswerOnlyOverride?: boolean): { systemPrompt: string; userMsg: string } {
        const ANSWER_ONLY_SYSTEM_PROMPT = I.ANSWER_ONLY_SYSTEM_PROMPT;
        const getActiveSearchProvider = I.getActiveSearchProvider;

        const settings = window.xdAnswers.settings;
        let systemPrompt = questionData.customPromptPrefix || settings.promptPrefix;
        if (showAnswerOnlyOverride !== undefined ? showAnswerOnlyOverride : (settings.showAnswerOnly || settings.silentMode === 'oneclick')) {
            systemPrompt = ANSWER_ONLY_SYSTEM_PROMPT;
        }

        // When web search is enabled, append tool usage instructions to system prompt
        if (!questionData.disableTools && settings.webSearchEnabled && getActiveSearchProvider(settings)) {
            systemPrompt += '\n\nУ тебе є доступ до інструмента web_search для пошуку в інтернеті. Використовуй його, коли потрібно знайти актуальну інформацію, факти, дати або деталі, яких може не бути у твоїх навчальних даних. Це особливо корисно для питань про поточні події, історичні дати, наукові факти тощо. Не викликай пошук, якщо впевнений у відповіді.';
        }

        let userMsg = '';
        // Inject test topic context when available (extracted by provider from page/API)
        if (questionData.topic) {
            console.log('[xdAnswers] Topic context injected:', questionData.topic, questionData.topicDescription ? '| ' + questionData.topicDescription.slice(0, 80) + '...' : '');
            userMsg += 'Тема тесту: ' + questionData.topic + '\n';
            if (questionData.topicDescription) {
                userMsg += 'Опис: ' + questionData.topicDescription + '\n';
            }
            userMsg += '\n';
        } else {
            console.log('[xdAnswers] No topic context available for this question');
        }
        if (questionData.questionType === 'matching') {
            userMsg += 'Це завдання на відповідність. Зістав елементи.\n\n';
        } else if (questionData.questionType === 'true_false') {
            userMsg += 'Це завдання з кількома твердженнями, де треба вибрати ОДНЕ правильне. '
                + 'У полі answer скопіюй ТОЧНИЙ текст обраного твердження зі списку нижче. '
                + 'Якщо питання справді має відповідь лише "Правда" або "Неправда", тоді відповідай одним словом "Правда" або "Неправда".\n\n';
        } else if (questionData.questionType === 'ordering') {
            userMsg += 'Це завдання на впорядкування. Розташуй елементи у правильному порядку. '
                + 'У полі answer перерахуй їх через крапку з комою у потрібному порядку: елемент1; елемент2; елемент3. '
                + 'Використовуй точні тексти елементів зі списку нижче.\n\n';
        } else if (questionData.questionType === 'range') {
            userMsg += 'Це завдання з вибором числа на шкалі. У полі answer вкажи ОДНЕ число без одиниць вимірювання та без пояснень.\n\n';
        } else if (questionData.questionType === 'date_time') {
            userMsg += 'Це завдання з датою та/або часом. У полі answer вкажи дату у форматі DD.MM.YYYY та час у форматі HH:MM, якщо час потрібен.\n\n';
        } else if (questionData.questionType === 'fill_word') {
            userMsg += 'Це завдання-філворд або кросворд. У полі answer вкажи потрібні слова через крапку з комою.\n\n';
        } else if (questionData.questionType === 'fill_blank') {
            userMsg += 'У питанні є пропуски з ключами A0, A1, A2 тощо (див. текст питання). '
                + 'У полі answer перерахуй заповнення для кожного ключа у форматі: A0=значення1; A1=значення2; A2=значення3. '
                + 'Значення — коротке слово або фраза, яка підходить у пропуск.\n\n';
        } else if (questionData.questionType === 'select_in_text') {
            userMsg += 'У питанні є пропуски з ключами A0, A1, A2 — для кожного вказано список доступних варіантів у квадратних дужках [варіант1 | варіант2 | ...]. '
                + 'Обери ОДИН варіант зі списку для кожного пропуску. У полі answer вкажи: A0=обраний_варіант; A1=обраний_варіант.\n\n';
        } else if (questionData.questionType === 'order_words') {
            userMsg += 'Розташуй слова/фрагменти у правильному порядку. У полі answer перерахуй їх через крапку з комою у потрібному порядку: слово1; слово2; слово3. '
                + 'Використовуй точно ті слова, що перелічені у варіантах. '
                + 'Якщо у завданні кілька рядків, дай відповідь для кожного рядка окремим рядком, зберігаючи порядок рядків.\n\n';
        } else if (questionData.questionType === 'categorization') {
            userMsg += 'Це завдання на розподіл елементів по категоріях. '
                + 'У полі answer вкажи результат у форматі: Категорія1: елемент1, елемент2; Категорія2: елемент3, елемент4. '
                + 'Використовуй точні назви категорій та елементів зі списку.\n\n';
        } else if (questionData.questionType === 'text_input_multi') {
            userMsg += 'Це питання з кількома полями для відповідей (перелічені у варіантах). '
                + 'У полі answer дай відповіді у тому ж порядку через крапку з комою: відповідь1; відповідь2; відповідь3.\n\n';
        } else if (questionData.questionType === 'grid') {
            userMsg += 'Це завдання типу "таблиця" (сітка): для КОЖНОГО рядка треба вибрати стовпець, '
                + 'тобто встановити відповідність між рядком і стовпцем. '
                + 'У полі answer вкажи пари у форматі: <текст рядка>=<текст стовпця>, розділяючи пари крапкою з комою. '
                + 'Приклад: кинутий камінь=перший закон Ньютона; дощова крапля=перший закон Ньютона. '
                + 'Використовуй ТОЧНІ тексти рядків і стовпців зі списку нижче. ';
            const isCheckboxGrid = !!questionData.isMulti;
            userMsg += isCheckboxGrid
                ? 'За умовою може бути кілька правильних стовпців для одного рядка — тоді вкажи кілька пар з тим самим рядком. '
                : 'Для кожного рядка, зазвичай, правильний лише один стовпець. ';
            userMsg += 'Якщо за умовою якийсь рядок зайвий — просто не вказуй його пару.\n\n';
        } else if (questionData.questionType === 'match_pairs') {
            userMsg += 'Це завдання на відповідність: для КОЖНОГО рядка треба підібрати варіант. '
                + 'У полі answer вкажи пари у форматі: <текст рядка>=<текст варіанта>, розділяючи пари крапкою з комою. '
                + 'Приклад: 1=виділяється газ; 2=утворюється білий осад. '
                + 'Рядок можна вказувати як його номер (1, 2, 3...) або як [зображення N], якщо рядок — картинка. '
                + 'Використовуй ТОЧНІ тексти варіантів зі списку нижче. Якщо варіантів більше, ніж рядків, якийсь варіант залишиться зайвим — це нормально.\n\n';
        } else if (questionData.questionType === 'true_false_multi') {
            userMsg += 'Це завдання з кількома твердженнями, де для кожного треба вибрати "Правда" або "Хиба". '
                + 'У полі answer для КОЖНОГО твердження (за його номером) вкажи Правда або Хиба, розділяючи крапкою з комою у форматі: 1=Правда; 2=Хиба; 3=Правда.\n\n';
        } else if (questionData.isMultiQuiz || questionData.isMulti) {
            const isMatchingLike = /відповідність|з'єднай|сполуч|поєднай|matching/i.test(questionData.text || '');
            if (isMatchingLike) {
                userMsg += 'Це питання типу multiquiz (кілька правильних відповідей), хоча виглядає як завдання на відповідність. У полі answer перерахуй ТІЛЬКИ текст правильних варіантів ЗІ СПИСКУ, а не пари чи зіставлення. Кожен правильний варіант — окремий елемент зі списку.\n\n';
            } else {
                userMsg += 'Це питання може мати КІЛЬКА правильних відповідей.\n\n';
            }
        } else if (['short_text', 'paragraph', 'open_ended'].includes(questionData.questionType as string)) {
            userMsg += 'Це відкрите питання. Дай розгорнуту відповідь.\n\n';
        }

        userMsg += 'Питання: ' + questionData.text;
        if (questionData.optionsText) {
            userMsg += '\nВаріанти:\n' + questionData.optionsText;
            // Якщо є варіанти-зображення, підкажемо AI що вони серед прикріплених картинок
            const isChoiceQuestion = questionData.questionType === 'quiz' || !!questionData.isMulti;
            if (isChoiceQuestion && /\[зображення(?:\s+\d+)?\]/.test(questionData.optionsText) && (questionData.base64Images || []).length > 0) {
                userMsg += '\nУВАГА: Варіанти позначені [зображення] — це картинки серед прикріплених зображень. Спочатку йде картинка запитання, потім картинки варіантів у порядку A, B, C...';
            }
            const specialAnswerTypes = new Set([
                'true_false', 'grid', 'match_pairs', 'true_false_multi',
                'fill_blank', 'select_in_text', 'order_words', 'ordering',
                'categorization', 'text_input_multi', 'range', 'fill_word'
            ]);
            if (!specialAnswerTypes.has(questionData.questionType || '')) {
                userMsg += '\n\nНагадування: твоя відповідь — ОДИН ІЗ ВАРІАНТІВ зі списку. Формат: answer: <скопіюй точний текст>';
            }
        }

        return { systemPrompt, userMsg };
    }

    I.buildMessages = buildMessages;
})();
