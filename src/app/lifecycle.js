import { state } from './store.ts';
import { THEME_KEY, CATEGORY_KEY, PRESET_KEY, METADATA_KEY } from '../storage/keys.js';
import { normalizeArtists, applyArtistDeduplication } from '../features/artists/identity.js';
import { localArchive } from '../storage/localArchive.js';
import { actions } from './actions.js';
import { renderAppStructure, updateTheme, renderAll } from './render.ts';
import { migrateBrowserArchiveToLocal } from '../storage/migration.js';
import { showToast } from '../shared/notifications.js';

const init = async () => {
                const readStoredJson = (key, fallback) => {
                    const raw = localStorage.getItem(key);
                    if (!raw) return fallback;
                    try {
                        const parsed = JSON.parse(raw);
                        return parsed ?? fallback;
                    } catch (error) {
                        console.warn(`Ignoring invalid local storage value: ${key}`, error);
                        return fallback;
                    }
                };
                state.theme = localStorage.getItem(THEME_KEY) || 'light';
                const storedCategories = readStoredJson(CATEGORY_KEY, null);
                const storedPresets = readStoredJson(PRESET_KEY, null);
                state.categories = Array.isArray(storedCategories) ? storedCategories.filter(c => typeof c === 'string') : ["二次元", "厚涂", "写实", "水墨", "黑白", "R18"];
                state.presets = Array.isArray(storedPresets) ? storedPresets.filter(p => p && typeof p === 'object') : [];
                const savedMeta = localStorage.getItem(METADATA_KEY);
                if(savedMeta) {
                    try {
                        state.artists = normalizeArtists(JSON.parse(savedMeta));
                    } catch(e) { state.artists = []; }
                }
                const localPayload = await localArchive.connect();
                const shouldMigrateBrowserArchive = Boolean(localArchive.available && !localArchive.initialized);
                if (localArchive.available && localArchive.initialized && localPayload) {
                    state.theme = localPayload.theme === 'dark' ? 'dark' : 'light';
                    state.categories = Array.isArray(localPayload.categories) ? localPayload.categories.filter(c => typeof c === 'string') : [];
                    state.presets = Array.isArray(localPayload.presets) ? localPayload.presets.filter(p => p && typeof p === 'object').map(p => ({ ...p, id: String(p.id), items: Array.isArray(p.items) ? p.items.map(item => ({ ...item, id: String(item.id) })) : [] })) : [];
                    state.artists = normalizeArtists(localPayload.artists);
                }
                const repairedDuplicates = await applyArtistDeduplication();
                if (repairedDuplicates) {
                    actions.saveMeta();
                    actions.savePresets();
                    console.info(`Merged ${repairedDuplicates} duplicate artist records.`);
                }
                renderAppStructure();
                updateTheme();
                renderAll();
                if (shouldMigrateBrowserArchive) {
                    migrateBrowserArchiveToLocal().catch(error => {
                        console.error('Browser archive migration failed:', error);
                        showToast(`迁移失败：${error.message || error}`);
                    });
                }
            };

const setTheme = (t) => { state.theme = t; localStorage.setItem(THEME_KEY, t); localArchive.scheduleSave(); updateTheme(); };

export { init, setTheme };
