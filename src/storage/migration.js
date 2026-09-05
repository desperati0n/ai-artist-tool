import { localArchive } from './localArchive.js';
import { showToast } from '../shared/notifications.js';
import { state } from '../app/store.ts';
import { browserDb } from './browser.js';
import { renderSidebarLeft } from '../app/render.ts';

const migrateBrowserArchiveToLocal = async () => {
            if (!localArchive.available || localArchive.initialized) return;
            showToast('正在把浏览器存档迁移到项目 data 目录...');
            await localArchive.flush();
            const ids = [...new Set([
                ...state.artists.map(item => String(item.id)),
                ...state.presets.map(item => String(item.id))
            ])];
            let migrated = 0;
            let failed = 0;
            for (const id of ids) {
                let image = null;
                try { image = await browserDb.get(id); }
                catch (error) { failed++; console.warn(`Unable to read browser image ${id}:`, error); continue; }
                if (!image) continue;
                try {
                    await localArchive.putImage(id, image);
                    migrated++;
                } catch (error) {
                    failed++;
                    console.warn(`Unable to migrate browser image ${id}:`, error);
                }
            }
            localArchive.initialized = true;
            renderSidebarLeft();
            showToast(failed
                ? `本地迁移完成：${migrated} 张图片，${failed} 张失败；浏览器旧副本仍保留`
                : `本地迁移完成：${migrated} 张原图；浏览器旧副本暂时保留`);
        };

export { migrateBrowserArchiveToLocal };
