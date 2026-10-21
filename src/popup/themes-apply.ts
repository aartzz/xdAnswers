// @ts-nocheck — popup UI module. Preset themes, colour helpers and applying the theme to the popup.
import { M3_PALETTE_COLORS } from './providers';
import { autoSave, saveSettingsAndNotify } from './settings';
import { initM3Selects, populateUI } from './ui';
import { settings, uiElements } from './state';
import { t } from './i18n';
import { renderThemeSettings } from './themes-settings';

export const PREDEFINED_THEMES = {
    'Dark': { borderColor: '#cccccc', contentColor: '#1c1c1c', headerColor: '#333333', textColor: '#e0e0e0' },
    'AMOLED': { borderColor: '#ffffff', contentColor: '#000000', headerColor: '#111111', textColor: '#ffffff' },
    'Indigo': { borderColor: '#6366f1', contentColor: '#1e1e2e', headerColor: '#2a2a3e', textColor: '#cdd6f4' },
    'Light': { borderColor: '#6366f1', contentColor: '#f5f5f7', headerColor: '#e8e6f0', textColor: '#1a1a2e' },
    'Rose': { borderColor: '#f43f5e', contentColor: '#1a0a10', headerColor: '#2a0a18', textColor: '#fecdd3' },
    'Emerald': { borderColor: '#10b981', contentColor: '#0a1a14', headerColor: '#0d2818', textColor: '#d1fae5' },
    'Amber': { borderColor: '#f59e0b', contentColor: '#140f00', headerColor: '#2a1f00', textColor: '#fef3c7' }
};

export function isColorDark(hex) {
    const c = hex.replace('#', '');
    const r = parseInt(c.substring(0, 2), 16);
    const g = parseInt(c.substring(2, 4), 16);
    const b = parseInt(c.substring(4, 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance < 0.45;
}

export function blendHex(baseHex, tintHex, tintRatio) {
    const b = (baseHex || '#121316').replace('#', '');
    const t = (tintHex || '#3b82f6').replace('#', '');
    const br = parseInt(b.substring(0, 2), 16) || 0;
    const bg = parseInt(b.substring(2, 4), 16) || 0;
    const bb = parseInt(b.substring(4, 6), 16) || 0;
    const tr = parseInt(t.substring(0, 2), 16) || 0;
    const tg = parseInt(t.substring(2, 4), 16) || 0;
    const tb = parseInt(t.substring(4, 6), 16) || 0;
    const r = Math.round(br * (1 - tintRatio) + tr * tintRatio);
    const g = Math.round(bg * (1 - tintRatio) + tg * tintRatio);
    const bl = Math.round(bb * (1 - tintRatio) + tb * tintRatio);
    return '#' + [r, g, bl].map(x => x.toString(16).padStart(2, '0')).join('');
}

export function hexToRgb(hex) {
    const c = (hex || '#6366f1').replace('#', '');
    const r = parseInt(c.substring(0, 2), 16) || 0;
    const g = parseInt(c.substring(2, 4), 16) || 0;
    const b = parseInt(c.substring(4, 6), 16) || 0;
    return `${r}, ${g}, ${b}`;
}

export function applyThemeToPopup() {
    const root = document.documentElement;
    const c = settings.customization || {};
    const engine = settings.themeEngine || 'material3';
    const isM3 = engine !== 'legacy';
    const isDark = isColorDark(c.contentColor);

    const beerCss = document.getElementById('beercss-stylesheet');
    const m3Css = document.getElementById('beercss-m3-stylesheet');
    if (beerCss) beerCss.disabled = !isM3;
    if (m3Css) m3Css.disabled = !isM3;

    document.body.classList.toggle('theme-material3', isM3);
    document.body.classList.toggle('dark', isDark);
    document.body.classList.toggle('light', !isDark);
    root.classList.toggle('dark', isDark);
    root.classList.toggle('light', !isDark);
    document.body.classList.toggle('theme-legacy', !isM3);

    if (isM3) {
        const primaryColor = c.borderColor || (isDark ? '#a8c7fa' : '#3b82f6');
        root.style.setProperty('--primary', primaryColor);
        root.style.setProperty('--m3-primary', primaryColor);
        document.body.style.setProperty('--m3-primary', primaryColor);
        root.style.setProperty('--on-primary', isColorDark(primaryColor) ? '#ffffff' : '#000000');
        root.style.setProperty('--m3-on-primary', isColorDark(primaryColor) ? '#ffffff' : '#000000');
        document.body.style.setProperty('--m3-on-primary', isColorDark(primaryColor) ? '#ffffff' : '#000000');

        if (isDark) {
            const isDarkPrimary = isColorDark(primaryColor);
            root.style.setProperty('--primary-container', isDarkPrimary ? primaryColor : 'rgba(' + hexToRgb(primaryColor) + ', 0.35)');
            root.style.setProperty('--m3-primary-container', isDarkPrimary ? primaryColor : 'rgba(' + hexToRgb(primaryColor) + ', 0.35)');
            document.body.style.setProperty('--m3-primary-container', isDarkPrimary ? primaryColor : 'rgba(' + hexToRgb(primaryColor) + ', 0.35)');
            root.style.setProperty('--on-primary-container', '#ffffff');
            root.style.setProperty('--m3-on-primary-container', '#ffffff');

            // Tint M3 dark surfaces with the accent palette color for Material You tonal surface effect
            const surfaceBase = blendHex('#121316', primaryColor, 0.05);
            const surfaceMid = blendHex('#1e1f23', primaryColor, 0.08);
            const surfaceHigh = blendHex('#282a2e', primaryColor, 0.11);
            const surfaceHighest = blendHex('#333539', primaryColor, 0.14);

            root.style.setProperty('--surface', surfaceBase);
            document.body.style.setProperty('--m3-surface', surfaceBase);
            root.style.setProperty('--surface-container', surfaceMid);
            document.body.style.setProperty('--m3-surface-mid', surfaceMid);
            document.body.style.setProperty('--m3-surface-high', surfaceHigh);
            document.body.style.setProperty('--m3-surface-highest', surfaceHighest);
            root.style.setProperty('--on-surface', '#e2e2e6');
            document.body.style.setProperty('--m3-on-surface', '#e2e2e6');
        } else {
            root.style.setProperty('--primary-container', primaryColor);
            root.style.setProperty('--m3-primary-container', primaryColor);
            document.body.style.setProperty('--m3-primary-container', primaryColor);
            root.style.setProperty('--on-primary-container', '#ffffff');
            root.style.setProperty('--m3-on-primary-container', '#ffffff');

            // Tint M3 light surfaces with the accent palette color
            const surfaceBase = blendHex('#f8fafc', primaryColor, 0.04);
            const surfaceMid = blendHex('#f1f5f9', primaryColor, 0.08);
            const surfaceHigh = blendHex('#e2e8f0', primaryColor, 0.12);
            const surfaceHighest = blendHex('#cbd5e1', primaryColor, 0.15);

            root.style.setProperty('--surface', surfaceBase);
            document.body.style.setProperty('--m3-surface', surfaceBase);
            root.style.setProperty('--surface-container', surfaceMid);
            document.body.style.setProperty('--m3-surface-mid', surfaceMid);
            document.body.style.setProperty('--m3-surface-high', surfaceHigh);
            document.body.style.setProperty('--m3-surface-highest', surfaceHighest);
            root.style.setProperty('--on-surface', '#0f172a');
            document.body.style.setProperty('--m3-on-surface', '#0f172a');
        }
    }

    root.style.setProperty('--popup-bg', c.contentColor);
    root.style.setProperty('--header-bg', c.headerColor);
    root.style.setProperty('--popup-text', c.textColor);
    root.style.setProperty('--popup-border', c.borderColor);
    document.body.style.setProperty('--popup-border', c.borderColor);
    document.body.style.setProperty('--primary', c.borderColor);
    root.classList.toggle('xd-dark-icons', isDark);
    root.classList.toggle('xd-light-icons', !isDark);
    initM3Selects();
}

/**
 * initM3Selects — wraps native <select> elements with a custom M3 dropdown
 * when theme is material3. Syncs value back via dispatchEvent('change') so
 * existing onchange listeners work unmodified.
 */

export function populateThemesGrid() {
    renderThemeSettings();
}
