// src/popup/core/state.ts
// @ts-nocheck — shared mutable popup state (settings, DOM refs, caches).

export let settings: any;
export const uiElements: any = {};
export let allModels: any[] = [];
export let modelsDevCache: any = null;
export const providerModelsCache: any = {};

export function setSettings(next: any): void { settings = next; }
export function setAllModels(models: any[]): void { allModels = models; }
export function setModelsDevCache(cache: any): void { modelsDevCache = cache; }
