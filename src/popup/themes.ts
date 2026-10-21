// src/popup/themes.ts
// @ts-nocheck — popup UI module. Theme presets, palette math, theme grid/editor rendering.
import { M3_PALETTE_COLORS } from './providers';
import { autoSave, saveSettingsAndNotify } from './settings';
import { initM3Selects, populateUI } from './ui';
import { settings, uiElements } from './state';
import { t } from './i18n';

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

export function renderThemeSettings() {
    const c = settings.customization || {};
    const isDark = isColorDark(c.contentColor);

    // 1. Update Segmented Buttons (Dark / Light)
    const modeBtns = document.querySelectorAll('.theme-mode-btn');
    modeBtns.forEach(btn => {
        const mode = btn.dataset.mode;
        const isActive = (mode === 'dark' && isDark) || (mode === 'light' && !isDark);
        btn.classList.toggle('active', isActive);
        btn.setAttribute('aria-checked', isActive ? 'true' : 'false');
    });

    // 2. Render Swatches
    const container = document.getElementById('theme-palette-swatches');
    if (!container) return;

    const currentBorder = (c.borderColor || '#3b82f6').toLowerCase();
    const existingSwatches = container.querySelectorAll('.theme-swatch:not(.custom)');

    if (existingSwatches.length === M3_PALETTE_COLORS.length) {
        // In-place update: smooth transition without wiping DOM nodes
        existingSwatches.forEach((swatch, idx) => {
            const item = M3_PALETTE_COLORS[idx];
            const isMatch = currentBorder === item.color.toLowerCase();
            swatch.classList.toggle('active', isMatch);
            swatch.innerHTML = isMatch ? '<span class="swatch-check">check</span>' : '';
        });
        const customBtn = container.querySelector('.theme-swatch.custom');
        if (customBtn) {
            const isPreset = M3_PALETTE_COLORS.some(item => item.color.toLowerCase() === currentBorder);
            customBtn.classList.toggle('active', !isPreset);
            if (!isPreset) {
                customBtn.style.backgroundColor = currentBorder;
                customBtn.innerHTML = '<span class="swatch-check">colorize</span>';
            } else {
                customBtn.style.backgroundColor = '';
                customBtn.innerHTML = '<span class="swatch-icon">colorize</span>';
            }
        }
        return;
    }

    container.innerHTML = '';
    let isPresetSelected = false;

    M3_PALETTE_COLORS.forEach(item => {
        const swatch = document.createElement('button');
        swatch.type = 'button';
        swatch.className = 'theme-swatch';
        swatch.style.backgroundColor = item.color;
        swatch.title = item.name;
        swatch.setAttribute('aria-label', item.name);

        const isMatch = currentBorder === item.color.toLowerCase();
        if (isMatch) {
            swatch.classList.add('active');
            isPresetSelected = true;
            swatch.innerHTML = '<span class="swatch-check">check</span>';
        }

        swatch.addEventListener('click', async () => {
            const pickerBox = document.getElementById('theme-palette-picker-container');
            if (pickerBox) pickerBox.classList.add('hidden');
            settings.customization.borderColor = item.color;
            applyThemeToPopup();
            renderThemeSettings();
            await autoSave({ 'customization.borderColor': item.color });
        });

        container.appendChild(swatch);
    });

    // Inline custom color button & inline expandable picker
    const customWrap = document.createElement('div');
    customWrap.className = 'theme-swatch-custom-wrap';

    const customBtn = document.createElement('button');
    customBtn.type = 'button';
    customBtn.className = 'theme-swatch custom';
    customBtn.title = t('themeCustomColor');
    customBtn.setAttribute('aria-label', t('themeCustomColor'));

    if (!isPresetSelected) {
        customBtn.classList.add('active');
        customBtn.style.backgroundColor = currentBorder;
        customBtn.innerHTML = '<span class="swatch-check">colorize</span>';
    } else {
        customBtn.innerHTML = '<span class="swatch-icon">colorize</span>';
    }

    const pickerContainer = document.getElementById('theme-palette-picker-container');

    customBtn.addEventListener('click', () => {
        if (!pickerContainer) return;
        const isHidden = pickerContainer.classList.contains('hidden');
        if (isHidden) {
            renderInlineCustomPicker(pickerContainer, currentBorder);
            pickerContainer.classList.remove('hidden');
        } else {
            pickerContainer.classList.add('hidden');
        }
    });

    customWrap.appendChild(customBtn);
    container.appendChild(customWrap);
}

export function renderInlineCustomPicker(container, currentColor) {
    container.innerHTML = `
        <div class="inline-color-picker-box">
            <div class="inline-color-picker-row">
                <input type="text" id="inline-hex-input" class="inline-hex-input" value="${currentColor}" maxlength="7" placeholder="#3b82f6" />
                <input type="color" id="inline-native-color" class="inline-color-swatch-btn" value="${currentColor}" />
            </div>
            <div class="inline-color-quick-shades">
                ${['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#ffffff', '#94a3b8', '#64748b', '#000000'].map(h => `
                    <button type="button" class="quick-shade-btn" style="background:${h}" data-hex="${h}"></button>
                `).join('')}
            </div>
        </div>
    `;

    const hexInput = container.querySelector('#inline-hex-input');
    const colorBtn = container.querySelector('#inline-native-color');
    const shadeBtns = container.querySelectorAll('.quick-shade-btn');

    const updateColor = async (hex) => {
        settings.customization.borderColor = hex;
        applyThemeToPopup();
        renderThemeSettings();
        await autoSave({ 'customization.borderColor': hex });
    };

    if (hexInput) {
        hexInput.addEventListener('change', () => {
            const val = hexInput.value.trim();
            if (/^#[0-9a-fA-F]{6}$/.test(val)) {
                if (colorBtn) colorBtn.value = val;
                updateColor(val);
            }
        });
        hexInput.addEventListener('input', () => {
            const val = hexInput.value.trim();
            if (/^#[0-9a-fA-F]{6}$/.test(val)) {
                if (colorBtn) colorBtn.value = val;
                settings.customization.borderColor = val;
                applyThemeToPopup();
            }
        });
    }

    if (colorBtn) {
        colorBtn.addEventListener('input', (e) => {
            const val = e.target.value;
            if (hexInput) hexInput.value = val;
            settings.customization.borderColor = val;
            applyThemeToPopup();
        });
        colorBtn.addEventListener('change', (e) => {
            updateColor(e.target.value);
        });
    }

    shadeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const hex = btn.dataset.hex;
            if (hexInput) hexInput.value = hex;
            if (colorBtn) colorBtn.value = hex;
            updateColor(hex);
        });
    });
}

export function openThemeEditor() {
    const el = uiElements;
    if (!el.themeEditor) return;
    const base = settings.customization;
    const fields = [
        ['editorName', base.borderColor /* unused */, null],
    ];
    el.editorName.value = '';
    const defaults = {
        editorBorderInput: base.borderColor,
        editorHeaderInput: base.headerColor,
        editorContentInput: base.contentColor,
        editorTextInput: base.textColor
    };
    const pickers = {
        editorBorderInput: el.editorBorderPicker,
        editorHeaderInput: el.editorHeaderPicker,
        editorContentInput: el.editorContentPicker,
        editorTextInput: el.editorTextPicker
    };
    for (const [key, val] of Object.entries(defaults)) {
        el[key].value = val;
        const normalised = normaliseHex(val);
        if (pickers[key] && normalised) pickers[key].value = normalised;
    }
    el.themeEditor.classList.remove('hidden');
    el.editorName.focus();
}

export function closeThemeEditor() {
    const el = uiElements;
    if (!el.themeEditor) return;
    el.themeEditor.classList.add('hidden');
}

export async function saveCustomTheme() {
    const el = uiElements;
    const name = (el.editorName.value || '').trim() || `${t('customPrefix')} ${(settings.customThemes?.length || 0) + 1}`;
    const borderColor = normaliseHex(el.editorBorderInput.value);
    const headerColor = normaliseHex(el.editorHeaderInput.value);
    const contentColor = normaliseHex(el.editorContentInput.value);
    const textColor = normaliseHex(el.editorTextInput.value);
    if (!borderColor || !headerColor || !contentColor || !textColor) {
        // Visual hint: flash invalid inputs red
        [el.editorBorderInput, el.editorHeaderInput, el.editorContentInput, el.editorTextInput].forEach(inp => {
            const val = normaliseHex(inp.value);
            inp.classList.toggle('invalid', !val);
        });
        return;
    }

    const theme = { name, borderColor, headerColor, contentColor, textColor };
    if (!Array.isArray(settings.customThemes)) settings.customThemes = [];
    settings.customThemes.push(theme);

    // Apply the newly saved theme immediately
    settings.customization = { ...settings.customization, borderColor, headerColor, contentColor, textColor };

    closeThemeEditor();
    populateUI();
    await saveSettingsAndNotify(settings);
}

export function normaliseHex(val) {
    if (!val) return null;
    const m = val.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (!m) return null;
    let hex = m[1];
    if (hex.length === 3) {
        hex = hex.split('').map(c => c + c).join('');
    }
    return '#' + hex.toLowerCase();
}

export function setupColorInput(input, settingKey, cssVar, picker) {
    // Text input: validate on every keystroke, apply when valid.
    input.addEventListener('input', async (e) => {
        const val = e.target.value;
        const normalised = normaliseHex(val);
        if (!normalised) return;
        document.documentElement.style.setProperty(cssVar, normalised);
        settings.customization[settingKey] = normalised;
        if (picker) picker.value = normalised;
        await saveSettingsAndNotify(settings);
    });

    if (!picker) return;

    // Initial sync: expand/normalise whatever's in the text input.
    const initial = normaliseHex(input.value);
    if (initial) picker.value = initial;

    // Picker: fires continuously while dragging (input) and on close (change).
    // Write through to the text input + settings so both reflect the new colour.
    const applyFromPicker = async () => {
        const val = picker.value;
        if (!/^#[0-9a-f]{6}$/i.test(val)) return;
        const normalised = val.toLowerCase();
        input.value = normalised;
        document.documentElement.style.setProperty(cssVar, normalised);
        settings.customization[settingKey] = normalised;
        await saveSettingsAndNotify(settings);
    };
    picker.addEventListener('input', applyFromPicker);
    picker.addEventListener('change', applyFromPicker);
}
