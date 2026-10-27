// src/providers/wordwall/dom/index.ts
// Wordwall page info extraction: pageData contains everything needed to fetch the content model.
export interface WordwallPageInfo {
    authorUserId: number | null;
    activityGuid: string | null;
    templateId: number | null;
    activityTitle: string | null;
    userCdn: string | null;
}

export interface WordwallDomApi {
    readPageInfo(): WordwallPageInfo | null;
    title(): string;
}

(function() {
    'use strict';
    window.xdAnswers = window.xdAnswers || ({} as XdAnswers);
    window.xdAnswers._internal = window.xdAnswers._internal || ({} as XdAnswersInternal);
    const modules = (window.xdAnswers._internal.providerModules = window.xdAnswers._internal.providerModules || {});

    // pageData lives in the page world (inline <script>), invisible from the content
    // script world — scrape it from the document HTML instead.
    function readPageInfo(): WordwallPageInfo | null {
        const html = document.documentElement.innerHTML;
        const guid = html.match(/"activityGuid"\s*:\s*"([a-f0-9]{32})"/);
        if (!guid) return null;
        const author = html.match(/"authorUserId"\s*:\s*(\d+)/);
        const template = html.match(/"templateId"\s*:\s*(\d+)/);
        const title = html.match(/"activityTitle"\s*:\s*"((?:\\.|[^"\\])*)"/);
        const cdn = html.match(/"userCdn"\s*:\s*"([^"]*)"/);
        return {
            authorUserId: author ? parseInt(author[1], 10) : null,
            activityGuid: guid[1],
            templateId: template ? parseInt(template[1], 10) : null,
            activityTitle: title ? safeJsonString('"' + title[1] + '"') : null,
            userCdn: cdn ? cdn[1].replace(/\/$/, '') : 'https://user.cdn.wordwall.net'
        };
    }

    function safeJsonString(quoted: string): string | null {
        try {
            return JSON.parse(quoted) as string;
        } catch {
            return null;
        }
    }

    function title(): string {
        return document.title.replace(/\s*[-|.]\s*Wordwall.*$/i, '').trim();
    }

    modules.wordwall = modules.wordwall || {};
    modules.wordwall.dom = { readPageInfo, title } as WordwallDomApi;
})();
