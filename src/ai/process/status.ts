// src/ai/process/status.ts
// Elapsed-time formatting and the waiting-status line shown while a request is in flight.
(function() {
    'use strict';
    window.xdAnswers = window.xdAnswers || ({} as XdAnswers);
    window.xdAnswers._internal = window.xdAnswers._internal || ({} as XdAnswersInternal);

    const I = window.xdAnswers._internal;

    I.getProcessElapsed = function(startTime: number): string {
        const ms = Date.now() - startTime;
        const sec = Math.floor(ms / 1000);
        return sec >= 60 ? Math.floor(sec / 60) + 'm ' + (sec % 60) + 's' : sec + 's';
    };

    I.startWaitingStatus = function(startTime: number): void {
        if (window.xdAnswers._statusInterval) {
            clearInterval(window.xdAnswers._statusInterval);
            window.xdAnswers._statusInterval = null;
        }
        if (window.xdAnswers._streamTimerInterval) {
            clearInterval(window.xdAnswers._streamTimerInterval);
            window.xdAnswers._streamTimerInterval = null;
        }
        const answerContentDiv = window.xdAnswers.answerContentDiv;
        if (!answerContentDiv) return;
        answerContentDiv.innerHTML = '<div class="xd-loader"></div>';
        const statusDiv = document.createElement('div');
        statusDiv.className = 'xd-status';
        statusDiv.innerHTML = '<span class="xd-icon" style="font-size:14px !important;vertical-align:middle;margin-right:4px;">hourglass_top</span> Connecting...';
        answerContentDiv.appendChild(statusDiv);
        const statusInterval = setInterval(() => {
            // Always update footer elapsed
            const footerElapsed = window.xdAnswers.helperContainer?.querySelector('#xd-footer-elapsed');
            if (footerElapsed) footerElapsed.innerHTML = '<span class="xd-icon" style="font-size:13px !important;vertical-align:middle;margin-right:2px;">schedule</span> ' + I.getProcessElapsed(startTime);
            // Update status text if still showing
            const s = window.xdAnswers.answerContentDiv?.querySelector('.xd-status');
            if (s) s.innerHTML = '<span class="xd-icon" style="font-size:14px !important;vertical-align:middle;margin-right:4px;">hourglass_empty</span> Waiting for response...';
        }, 1000);
        window.xdAnswers._statusInterval = statusInterval as unknown as number;
    };
})();
