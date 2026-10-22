// src/dom/select/date.ts
// Normalizes date answers to the dd.MM.yyyy format used by MS Forms.
(function() {
    'use strict';
    window.xdAnswers = window.xdAnswers || ({} as XdAnswers);
    window.xdAnswers._internal = window.xdAnswers._internal || ({} as XdAnswersInternal);

    const I = window.xdAnswers._internal;

    function formatDateForMSForms(text: string): string {
        if (!text) return text;
        text = text.trim();
        // Already in dd.MM.yyyy format
        if (/^\d{1,2}\.\d{1,2}\.\d{4}$/.test(text)) return text;
        // ISO: yyyy-MM-dd → dd.MM.yyyy
        const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (iso) return `${iso[3]}.${iso[2]}.${iso[1]}`;
        // dd/mm/yyyy or dd-mm-yyyy where day > 12 (unambiguous day-first)
        const dmy = text.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
        if (dmy) {
            const a = parseInt(dmy[1]), b = parseInt(dmy[2]);
            if (a > 12 && b <= 12) {
                // a must be day, b is month
                return `${String(a).padStart(2,'0')}.${String(b).padStart(2,'0')}.${dmy[3]}`;
            }
            if (b > 12 && a <= 12) {
                // b must be day, a is month (US mm/dd/yyyy)
                return `${String(b).padStart(2,'0')}.${String(a).padStart(2,'0')}.${dmy[3]}`;
            }
        }
        // Try native Date parse for text formats ("January 15, 2024", etc.)
        try {
            const date = new Date(text);
            if (!isNaN(date.getTime()) && date.getFullYear() > 1900) {
                const day = String(date.getDate()).padStart(2, '0');
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const year = date.getFullYear();
                return `${day}.${month}.${year}`;
            }
        } catch (e) {}
        return text;
    }

    I.formatDateForMSForms = formatDateForMSForms;
})();
