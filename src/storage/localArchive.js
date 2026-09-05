import { state } from '../app/store.ts';
import { showToast } from '../shared/notifications.js';

const localArchive = {
            available: false,
            initialized: false,
            imageCount: 0,
            imageIndex: new Map(),
            imageIndexReady: false,
            suspendWrites: false,
            saveTimer: null,
            saveChain: Promise.resolve(),
            lastError: null,
            snapshot() {
                return {
                    version: 14,
                    updatedAt: new Date().toISOString(),
                    theme: state.theme,
                    categories: Array.isArray(state.categories) ? [...state.categories] : [],
                    artists: state.artists.filter(a => a && typeof a === 'object' && !a._ghost).map(({imageUrl, ...artist}) => artist),
                    presets: state.presets.filter(p => p && typeof p === 'object').map(({imageUrl, ...preset}) => preset)
                };
            },
            async connect() {
                if (location.protocol === 'file:') return null;
                try {
                    const controller = new AbortController();
                    const timer = setTimeout(() => controller.abort(), 1500);
                    const statusResponse = await fetch('/api/status', { cache: 'no-store', signal: controller.signal });
                    clearTimeout(timer);
                    if (!statusResponse.ok) return null;
                    const status = await statusResponse.json();
                    if (!status.localArchive) return null;
                    this.available = true;
                    this.initialized = Boolean(status.initialized);
                    this.imageCount = Number(status.imageCount) || 0;
                    const loadResponse = await fetch('/api/load', { cache: 'no-store' });
                    if (!loadResponse.ok) throw new Error(`读取本地存档失败 (${loadResponse.status})`);
                    const payload = await loadResponse.json();
                    this.initialized = Boolean(payload?._localArchive?.initialized);
                    this.imageIndex = new Map(Object.entries(payload?._localArchive?.imageIndex || {}));
                    this.imageIndexReady = true;
                    this.imageCount = this.imageIndex.size;
                    return payload;
                } catch (error) {
                    this.available = false;
                    this.lastError = error;
                    return null;
                }
            },
            scheduleSave() {
                if (!this.available || this.suspendWrites) return;
                clearTimeout(this.saveTimer);
                this.saveTimer = setTimeout(() => {
                    this.saveTimer = null;
                    this.flush().catch(error => {
                        console.error('Local archive save failed:', error);
                        showToast(`本地存档失败：${error.message || error}`);
                    });
                }, 180);
            },
            async flush() {
                if (!this.available || this.suspendWrites) return;
                if (this.saveTimer) {
                    clearTimeout(this.saveTimer);
                    this.saveTimer = null;
                }
                const payload = this.snapshot();
                this.saveChain = this.saveChain.catch(() => {}).then(async () => {
                    const response = await fetch('/api/save-meta', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                    if (!response.ok) {
                        const result = await response.json().catch(() => ({}));
                        throw new Error(result.error || `HTTP ${response.status}`);
                    }
                    this.initialized = true;
                });
                return this.saveChain;
            },
            async imageBlob(value) {
                if (value instanceof Blob) return value;
                if (typeof value !== 'string' || !value) throw new Error('无效图片数据');
                const response = await fetch(value);
                if (!response.ok) throw new Error(`读取待保存图片失败 (${response.status})`);
                return await response.blob();
            },
            imageUrl(id, version = 'local', thumbnail = false) {
                const endpoint = thumbnail ? 'thumbnail' : 'image';
                return `/api/${endpoint}/${encodeURIComponent(String(id))}?v=${encodeURIComponent(String(version))}`;
            },
            async putImage(id, value, options = {}) {
                const blob = await this.imageBlob(value);
                const response = await fetch(`/api/image/${encodeURIComponent(String(id))}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': blob.type || 'application/octet-stream',
                        ...(options.stripMetadata ? { 'X-Strip-Metadata': '1' } : {})
                    },
                    body: blob
                });
                const result = await response.json().catch(() => ({}));
                if (!response.ok) throw new Error(result.error || `图片写入失败 (${response.status})`);
                if (result.created) this.imageCount++;
                this.imageIndex.set(String(id), Number(result.version) || Date.now());
                return result.url || this.imageUrl(id);
            },
            async getImage(id, options = {}) {
                id = String(id);
                if (this.imageIndexReady) {
                    if (!this.imageIndex.has(id)) return null;
                    return this.imageUrl(id, this.imageIndex.get(id), Boolean(options.thumbnail));
                }
                const response = await fetch(`/api/image/${encodeURIComponent(String(id))}`, { method: 'HEAD', cache: 'no-store' });
                if (response.ok) return this.imageUrl(id, 'local', Boolean(options.thumbnail));
                if (response.status === 404) return null;
                throw new Error(`读取本地图片失败 (${response.status})`);
            },
            async deleteImage(id) {
                const response = await fetch(`/api/image/${encodeURIComponent(String(id))}`, { method: 'DELETE' });
                if (!response.ok) throw new Error(`删除本地图片失败 (${response.status})`);
                if (this.imageIndex.delete(String(id))) this.imageCount = Math.max(0, this.imageCount - 1);
            },
            async importZip(file, onProgress = () => {}) {
                return await new Promise((resolve, reject) => {
                    const request = new XMLHttpRequest();
                    request.open('POST', '/api/import-archive');
                    request.setRequestHeader('Content-Type', 'application/zip');
                    request.upload.addEventListener('progress', (event) => {
                        if (!event.lengthComputable) return;
                        onProgress({ phase: 'upload', percent: Math.round((event.loaded / event.total) * 100) });
                    });
                    request.upload.addEventListener('load', () => onProgress({ phase: 'restore', percent: null }));
                    request.addEventListener('error', () => reject(new Error('存档上传失败，请检查本地服务是否仍在运行')));
                    request.addEventListener('abort', () => reject(new Error('存档导入已取消')));
                    request.addEventListener('load', () => {
                        let result = {};
                        try { result = JSON.parse(request.responseText || '{}'); } catch (_) {}
                        if (request.status < 200 || request.status >= 300) {
                            reject(new Error(result.error || `存档恢复失败 (${request.status})`));
                            return;
                        }
                        resolve(result);
                    });
                    request.send(file);
                });
            }
        };

export { localArchive };
