// @ts-nocheck — popup UI module. Custom theme editor, hex normalisation and colour input wiring.
import { saveSettingsAndNotify } from '../core/settings';
import { populateUI } from '../core/ui';
import { settings, uiElements } from '../core/state';
import { t } from '../core/i18n';


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
