(function() {
    'use strict';

    window.xdAnswers = window.xdAnswers || ({} as XdAnswers);
    window.xdAnswers._internal = window.xdAnswers._internal || ({} as XdAnswersInternal);

    if (typeof __XD_VERSION__ !== 'undefined' && __XD_VERSION__) {
        window.xdAnswers._buildVersion = __XD_VERSION__;
    }

    // Version string for UI display
    // Set via esbuild compile-time define (__XD_VERSION__)
    function getVersionString(): string {
        if (typeof __XD_VERSION__ !== 'undefined' && __XD_VERSION__) {
            return __XD_VERSION__;
        }
        if (window.xdAnswers._buildVersion) return window.xdAnswers._buildVersion;
        try {
            const manifest = chrome.runtime.getManifest();
            return (manifest as any).version_name || (manifest.version ? 'v' + manifest.version : '');
        } catch (e) {
            return '';
        }
    }

    // Map a 3x3 grid preset to top/left/bottom/right CSS values.
    // Container is ~380px wide; keep 20px margin from viewport edges.
    function resolvePositionPreset(preset: string): XdPositionPreset {
        const M = '20px';
        const presets: Record<string, XdPositionPreset> = {
            'top-left':      { top: M,     left: M,    right: 'auto', bottom: 'auto' },
            'top-center':    { top: M,     left: '50%', right: 'auto', bottom: 'auto', translate: 'x' },
            'top-right':     { top: M,     right: M,   left: 'auto',  bottom: 'auto' },
            'middle-left':   { top: '50%', left: M,    right: 'auto', bottom: 'auto', translate: 'y' },
            'center':        { top: '50%', left: '50%', right: 'auto', bottom: 'auto', translate: 'xy' },
            'middle-right':  { top: '50%', right: M,   left: 'auto',  bottom: 'auto', translate: 'y' },
            'bottom-left':   { bottom: M,  left: M,    top: 'auto',   right: 'auto' },
            'bottom-center': { bottom: M,  left: '50%', top: 'auto',  right: 'auto', translate: 'x' },
            'bottom-right':  { bottom: M,  right: M,   top: 'auto',   left: 'auto' }
        };
        return presets[preset] || presets['bottom-right'];
    }

    window.xdAnswers._internal.getVersionString = getVersionString;
    window.xdAnswers._internal.resolvePositionPreset = resolvePositionPreset;
    window.xdAnswers.resolvePositionPreset = resolvePositionPreset;
})();
