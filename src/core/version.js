(function() {
    'use strict';

    window.xdAnswers = window.xdAnswers || {};
    window.xdAnswers._internal = window.xdAnswers._internal || {};

    // Version string for UI display
    // _buildVersion is injected by build-manifest.js (release) or inject-version.js (debug)
    // Release: "v5.0.3", Debug: "6774ea7", Fallback: reads manifest version
    function getVersionString() {
        if (window.xdAnswers._buildVersion) return window.xdAnswers._buildVersion;
        try {
            const v = chrome.runtime.getManifest().version;
            return v ? 'v' + v : '';
        } catch (e) {
            return '';
        }
    }

    // Map a 3x3 grid preset to top/left/bottom/right CSS values.
    // Container is ~380px wide; keep 20px margin from viewport edges.
    function resolvePositionPreset(preset) {
        const M = '20px';
        const presets = {
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
