// @ts-nocheck — popup UI module. Models module entry; re-exports the model parts.
import { PROVIDER_ICON_MAP, getActiveProvider } from './providers';
import { allModels, modelsDevCache, providerModelsCache, setAllModels, setModelsDevCache, settings, uiElements } from './state';
import { autoSave } from './settings';
import { escapeHTML, makeRequest } from './utils';
import { t } from './i18n';
export * from './models-meta';
export * from './models-fetch';
export * from './models-list';
