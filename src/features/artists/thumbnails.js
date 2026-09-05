import { localArchive } from '../../storage/localArchive.js';
import { state } from '../../app/store.ts';

const preloadThumbnailUrl = (url) => new Promise(resolve => {
            const image = new Image();
            image.decoding = 'async';
            image.onload = image.onerror = () => resolve();
            image.src = url;
        });

const scheduleThumbnailWarmup = (list, pageItems) => {
            if (!localArchive.available || !localArchive.imageIndexReady) return;
            const currentIds = new Set(pageItems.map(item => String(item.id)));
            const pageEnd = state.page * state.pageSize;
            const ordered = [...list.slice(pageEnd), ...list.slice(0, Math.max(0, pageEnd - state.pageSize))]
                .filter(item => !currentIds.has(String(item.id)));
            const token = ++state.thumbnailWarmupToken;
            setTimeout(async () => {
                const batchSize = 16;
                for (let offset = 0; offset < ordered.length && token === state.thumbnailWarmupToken; offset += batchSize) {
                    const urls = [];
                    for (const item of ordered.slice(offset, offset + batchSize)) {
                        const id = String(item.id);
                        if (state.preloadedThumbnailIds.has(id) || !localArchive.imageIndex.has(id)) continue;
                        state.preloadedThumbnailIds.add(id);
                        urls.push(localArchive.imageUrl(id, localArchive.imageIndex.get(id), true));
                    }
                    if (urls.length) await Promise.allSettled(urls.map(preloadThumbnailUrl));
                    await new Promise(resolve => setTimeout(resolve, 0));
                }
            }, 0);
        };

export { preloadThumbnailUrl, scheduleThumbnailWarmup };
