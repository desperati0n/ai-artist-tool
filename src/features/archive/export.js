import { state } from '../../app/store.ts';
import { showToast, showArchiveProgress, hideArchiveProgress } from '../../shared/notifications.js';
import { localArchive } from '../../storage/localArchive.js';
import { db } from '../../storage/images.js';

const exportData = async () => {
                if (state.exportRunning) return;
                state.exportRunning = true;
                showToast("打包中...");
                try {
                    if (localArchive.available) {
                        showArchiveProgress('导出存档', '正在同步最新元数据…', null);
                        await localArchive.flush();
                        const link = document.createElement('a');
                        link.href = `/api/export?t=${Date.now()}`;
                        link.rel = 'noopener';
                        document.body.appendChild(link);
                        link.click();
                        link.remove();
                        showArchiveProgress('导出已开始', '完整存档正在由本地服务生成，请在浏览器下载列表查看进度。', 100);
                        window.setTimeout(hideArchiveProgress, 2400);
                        return;
                    }
                    const exportedAt = new Date().toISOString();
                    const artists = state.artists.filter(artist => artist && typeof artist === 'object');
                    const presets = state.presets.filter(preset => preset && typeof preset === 'object');
                    const imageToDataUrl = async (value) => {
                        if (typeof value === 'string') return value;
                        if (!value || typeof FileReader === 'undefined' || typeof Blob === 'undefined' || !(value instanceof Blob)) return '';
                        return await new Promise((resolve) => {
                            const reader = new FileReader();
                            reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
                            reader.onerror = () => resolve('');
                            reader.readAsDataURL(value);
                        });
                    };
                    const readImageForExport = async (id, fallback) => {
                        const key = String(id);
                        let image = await imageToDataUrl(state.pageImages[key]);
                        if (!image) image = await imageToDataUrl(fallback);
                        if (!image) {
                            image = await imageToDataUrl(await db.get(key));
                            if (!image && db.lastError) throw db.lastError;
                        }
                        if (image) state.pageImages[key] = image;
                        return image;
                    };
                    const buildExport = async () => {
                        const data = [];
                        const imageErrors = [];
                        let imageCount = 0;
                        for (const artist of artists) {
                            let imageUrl = '';
                            try {
                                imageUrl = await readImageForExport(artist.id, artist.imageUrl);
                                if (imageUrl) imageCount++;
                            } catch (error) {
                                imageErrors.push({ type: 'artist', id: String(artist.id), error });
                                console.warn('Skipping artist image during export:', artist.id, error);
                            }
                            data.push({ ...artist, imageUrl });
                        }
                        const exportedPresets = [];
                        for (const preset of presets) {
                            let imageUrl = '';
                            try {
                                imageUrl = await readImageForExport(preset.id, preset.imageUrl);
                                if (imageUrl) imageCount++;
                            } catch (error) {
                                imageErrors.push({ type: 'preset', id: String(preset.id), error });
                                console.warn('Skipping preset image during export:', preset.id, error);
                            }
                            exportedPresets.push({
                                ...preset,
                                items: Array.isArray(preset.items) ? preset.items : [],
                                imageUrl
                            });
                        }
                        return {
                            version: 13,
                            exportComplete: true,
                            exportedAt,
                            imagesIncluded: imageCount > 0,
                            imageCount,
                            imageErrors: imageErrors.map(item => ({ type: item.type, id: item.id })),
                            theme: state.theme,
                            categories: Array.isArray(state.categories) ? [...state.categories] : [],
                            artists: data,
                            presets: exportedPresets
                        };
                    };
                    const downloadExport = (exportObj) => {
                        const replacer = (_key, value) => typeof value === 'bigint' ? String(value) : value;
                        const { artists = [], presets = [], ...metadata } = exportObj;
                        const metadataJson = JSON.stringify(metadata, replacer);
                        const parts = [metadataJson.slice(0, -1), ',"artists":['];
                        artists.forEach((artist, index) => {
                            if (index > 0) parts.push(',');
                            parts.push(JSON.stringify(artist, replacer));
                        });
                        parts.push('],"presets":[');
                        presets.forEach((preset, index) => {
                            if (index > 0) parts.push(',');
                            parts.push(JSON.stringify(preset, replacer));
                        });
                        parts.push(']}');
                        const blob = new Blob(parts, { type: "application/json;charset=utf-8" });
                        if (typeof URL.createObjectURL !== 'function') throw new Error('当前浏览器不支持大文件下载');
                        const url = URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.href = url;
                        const now = new Date();
                        const localDate = [
                            now.getFullYear(),
                            String(now.getMonth() + 1).padStart(2, '0'),
                            String(now.getDate()).padStart(2, '0')
                        ].join('-');
                        link.download = `artist_manager_backup_${localDate}.json`;
                        link.rel = 'noopener';
                        document.body.appendChild(link);
                        link.click();
                        link.remove();
                        // Large backups may still be streaming to the download manager after the click.
                        // Keep the object URL alive long enough to prevent a truncated JSON file.
                        if (url.startsWith('blob:')) window.setTimeout(() => URL.revokeObjectURL(url), 10 * 60 * 1000);
                        return exportObj;
                    };

                    const exportObj = await buildExport();
                    const failedImages = Array.isArray(exportObj.imageErrors) ? exportObj.imageErrors.length : 0;
                    if (failedImages > 0) {
                        exportObj.warning = `有 ${failedImages} 张图片读取失败，其余图片已写入备份；请在浏览器存储仍可访问时重新导出。`;
                    }
                    downloadExport(exportObj);
                    showToast(failedImages > 0
                        ? `导出完成：${exportObj.artists.length} 位画师，${exportObj.imageCount || 0} 张图片（${failedImages} 张失败）`
                        : `导出完成：${exportObj.artists.length} 位画师，${exportObj.imageCount || 0} 张图片`);
                } catch (error) {
                    hideArchiveProgress();
                    console.error('Export failed:', error);
                    const reason = error instanceof Error && error.message ? error.message : String(error || '未知错误');
                    showToast(`导出失败：${reason.slice(0, 28)}`);
                } finally {
                    state.exportRunning = false;
                }
            };

export { exportData };
