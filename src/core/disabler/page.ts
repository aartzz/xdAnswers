// @ts-nocheck — page-world script injected by src/core/disabler/disabler-inject.ts via a
// <script src> tag, so it runs in the page context where it can monkey-patch
// non-standard browser APIs (webkit/moz/ms fullscreen members, prototype
// overrides, visibility state). Typing these overrides would require `any`
// casts on nearly every line, so the file is intentionally left unchecked.
//
// Topic modules (focus, fullscreen, timing) sit next to this file. Provider-specific
// patches live in src/providers/<name>/disabler.ts and are bundled into this same
// page script (see scripts/build.js); they gate themselves on location.hostname.
import { installStealthGuard } from './stealth';
import { installFocusBypass } from './focus';
import { installFullscreenBypass } from './fullscreen';
import { installTimingGuard } from './timing';

(function() {
    'use strict';

    installStealthGuard();
    installFocusBypass();
    installFullscreenBypass();
    installTimingGuard();

    console.log('[xdAnswers Disabler] Global anti-detect active (blur/focus/visibility/fullscreen bypass)');
})();
