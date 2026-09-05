import { normalizeArtist, deduplicateArtists } from '../../shared/artistIdentity.js';
import { state } from '../../app/store.ts';
import { db } from '../../storage/images.js';

const normalizeArtists = (items) => (Array.isArray(items) ? items : [])
            .filter(a => a && typeof a === 'object')
            .map(normalizeArtist);

const remapPresetArtistIds = (presets, idMap) => (Array.isArray(presets) ? presets : []).map(preset => {
            const seen = new Set();
            const items = (Array.isArray(preset.items) ? preset.items : []).flatMap(item => {
                if (!item || typeof item !== 'object') return [];
                const id = idMap.get(String(item.id)) || String(item.id);
                if (seen.has(id)) return [];
                seen.add(id);
                return [{ ...item, id }];
            });
            return { ...preset, items };
        });

const applyArtistDeduplication = async () => {
            const { artists, idMap, duplicateCount } = deduplicateArtists(state.artists);
            if (!duplicateCount) return 0;

            const duplicateIds = [...idMap.entries()].filter(([sourceId, targetId]) => sourceId !== targetId);
            for (const [sourceId, targetId] of duplicateIds) {
                if (!state.pageImages[targetId] && state.pageImages[sourceId]) {
                    state.pageImages[targetId] = state.pageImages[sourceId];
                }
                try {
                    const targetImage = state.pageImages[targetId] || await db.get(targetId);
                    if (!targetImage) {
                        const sourceImage = state.pageImages[sourceId] || await db.get(sourceId);
                        if (sourceImage) state.pageImages[targetId] = await db.put(targetId, sourceImage);
                    }
                } catch (error) {
                    console.warn(`Unable to preserve duplicate artist image ${sourceId}:`, error);
                }
            }

            const remapRecord = (record) => Object.entries(record || {}).reduce((result, [id, value]) => {
                const targetId = idMap.get(String(id)) || String(id);
                if (!(targetId in result)) result[targetId] = value;
                return result;
            }, {});
            state.artists = artists;
            state.presets = remapPresetArtistIds(state.presets, idMap);
            state.selected = remapRecord(state.selected);
            state.batchSelected = remapRecord(state.batchSelected);
            state.selectedOrder = [...new Set((state.selectedOrder || []).map(id => idMap.get(String(id)) || String(id)))];
            return duplicateCount;
        };

export { normalizeArtists, remapPresetArtistIds, applyArtistDeduplication };
