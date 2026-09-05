import { writeBrowserMetadata, browserDb } from './browser.js';
import { METADATA_KEY, CATEGORY_KEY, PRESET_KEY } from './keys.js';
import { state } from '../app/store.ts';
import { localArchive } from './localArchive.js';
import { showToast } from '../shared/notifications.js';
import { renderGrid } from '../app/render.ts';

const saveMeta = () => { writeBrowserMetadata(METADATA_KEY, state.artists.map(({imageUrl, ...r})=>r)); localArchive.scheduleSave(); };

const saveCats = () => { writeBrowserMetadata(CATEGORY_KEY, state.categories); localArchive.scheduleSave(); };

const savePresets = () => { writeBrowserMetadata(PRESET_KEY, state.presets); localArchive.scheduleSave(); };

const releaseBrowserImages = async () => {
                if (!localArchive.available || !localArchive.initialized) return showToast('请先启动本地存档服务并完成迁移');
                const ids = [...new Set([...state.artists.map(a => String(a.id)), ...state.presets.map(p => String(p.id))])];
                showToast('正在核对本地原图...');
                const missing = [];
                for (const id of ids) {
                    const browserImage = await browserDb.get(id);
                    if (!browserImage) continue;
                    let localImage = await localArchive.getImage(id).catch(() => null);
                    if (!localImage) {
                        try { localImage = await localArchive.putImage(id, browserImage); }
                        catch (error) { console.warn(`Unable to finish migration for ${id}:`, error); }
                    }
                    if (!localImage) missing.push(id);
                }
                if (missing.length) return showToast(`暂不清理：有 ${missing.length} 张浏览器图片尚未迁移`);
                if (!confirm('已确认项目 data/images 中存在对应原图。确定清空浏览器里的旧图片副本以释放空间吗？')) return;
                await browserDb.clear();
                state.pageImages = {};
                renderGrid();
                showToast('浏览器旧图片已清理；本地原图不受影响');
            };

export { saveMeta, saveCats, savePresets, releaseBrowserImages };
