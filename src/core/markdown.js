(function() {
    'use strict';

    window.xdAnswers = window.xdAnswers || {};
    window.xdAnswers._internal = window.xdAnswers._internal || {};

    window.xdAnswers.renderMarkdown = function(text) {
        if (!text) return '';
        let h = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

        h = h.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) =>
            '<pre class="xd-code"><code>' + code.trim() + '</code></pre>');
        h = h.replace(/`([^`]+)`/g, '<code class="xd-icode">$1</code>');
        h = h.replace(/\$\$([\s\S]*?)\$\$/g, '<div class="xd-latex-block">$1</div>');
        h = h.replace(/\$([^\$\n]+)\$/g, '<span class="xd-latex">$1</span>');
        h = h.replace(/^### (.+)$/gm, '<h4>$1</h4>');
        h = h.replace(/^## (.+)$/gm, '<h3>$1</h3>');
        h = h.replace(/^# (.+)$/gm, '<h2>$1</h2>');
        h = h.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        h = h.replace(/__(.+?)__/g, '<strong>$1</strong>');
        h = h.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '<em>$1</em>');
        h = h.replace(/(?<!_)_([^_\n]+)_(?!_)/g, '<em>$1</em>');
        h = h.replace(/^[\*\-] (.+)$/gm, '<li>$1</li>');
        h = h.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>');
        h = h.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
        h = h.replace(/\[([^\]]+)\]\(([^\)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
        h = h.replace(/\n/g, '<br>');
        h = h.replace(/<br>(<\/ul>)/g, '$1').replace(/(<ul>)<br>/g, '$1');
        return h;
    };

    function escapeHTML(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    window.xdAnswers._internal.escapeHTML = escapeHTML;
})();
