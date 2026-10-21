// @ts-nocheck — popup UI module. Themes module entry; re-exports the theme parts.
import { M3_PALETTE_COLORS } from './providers';
import { autoSave, saveSettingsAndNotify } from './settings';
import { initM3Selects, populateUI } from './ui';
import { settings, uiElements } from './state';
import { t } from './i18n';
export * from './themes-apply';
export * from './themes-settings';
export * from './themes-editor';
