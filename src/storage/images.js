import { localArchive } from './localArchive.js';
import { state } from '../app/store.ts';
import { browserDb } from './browser.js';

const db = {
            lastError: null,
            async put(id, data, options = {}) {
                this.lastError = null;
                try {
                    if (localArchive.available) {
                        const saved = await localArchive.putImage(id, data, options);
                        delete state.thumbnailImages[String(id)];
                        state.preloadedThumbnailIds.delete(String(id));
                        return saved;
                    }
                    const saved = await browserDb.put(id, data);
                    delete state.thumbnailImages[String(id)];
                    state.preloadedThumbnailIds.delete(String(id));
                    return saved;
                } catch (error) {
                    this.lastError = error;
                    throw error;
                }
            },
            async get(id, options = {}) {
                this.lastError = null;
                if (localArchive.available) {
                    try {
                        const localImage = await localArchive.getImage(id, options);
                        if (localImage) return localImage;
                    } catch (error) {
                        this.lastError = error;
                    }
                }
                const browserImage = await browserDb.get(id);
                if (!browserImage && browserDb.lastError) this.lastError = browserDb.lastError;
                return browserImage;
            },
            async delete(id) {
                this.lastError = null;
                try {
                    if (localArchive.available) {
                        await localArchive.deleteImage(id);
                        delete state.thumbnailImages[String(id)];
                        state.preloadedThumbnailIds.delete(String(id));
                        try { await browserDb.delete(id); } catch (browserError) { console.warn('Unable to delete legacy browser image:', browserError); }
                    } else {
                        await browserDb.delete(id);
                        delete state.thumbnailImages[String(id)];
                        state.preloadedThumbnailIds.delete(String(id));
                    }
                } catch (error) {
                    this.lastError = error;
                    throw error;
                }
            },
            getBrowser: id => browserDb.get(id)
        };

const readImageWithoutReencoding = (file) => new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error || new Error('读取图片失败'));
        });

const compressImage = readImageWithoutReencoding;

export { db, readImageWithoutReencoding, compressImage };
