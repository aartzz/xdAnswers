// @ts-nocheck — popup UI module. Theme settings tab and inline custom colour picker.
import { M3_PALETTE_COLORS } from './providers';
import { autoSave, saveSettingsAndNotify } from './settings';
import { initM3Selects, populateUI } from './ui';
import { settings, uiElements } from './state';
import { t } from './i18n';
import { applyThemeToPopup, isColorDark } from './themes-apply';

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
