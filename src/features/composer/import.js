import { parsePromptInput } from './parser.js';
import { showToast } from '../../shared/notifications.js';
import { state } from '../../app/store.ts';
import { findEquivalentArtist } from '../../shared/artistIdentity.js';
import { renderGrid, renderSidebarRight, renderAll } from '../../app/render.ts';
import { db } from '../../storage/images.js';
import { applyArtistDeduplication } from '../artists/identity.js';
import { actions } from '../../app/actions.js';
import { generationApi } from '../generation/index.js';

const importFromPromptText = (text) => {
            const parsed = parsePromptInput(text);
            if (parsed.length === 0) return showToast('未检测到有效的画师标签');

            // Clear current selection and ghost entries
            state.selected = {};
            state.selectedOrder = [];
            state.artists = state.artists.filter(a => !a._ghost);

            let foundCount = 0;
            let ghostCount = 0;

            for (const item of parsed) {
                const artist = findEquivalentArtist(state.artists, { tag: item.tag, name: item.tag });

                if (artist) {
                    const id = String(artist.id);
                    if (!(id in state.selected)) {
                        state.selected[id] = item.weight;
                        state.selectedOrder.push(id);
                        foundCount++;
                    }
                } else {
                    // Not found → ghost placeholder
                    const ghostId = '_ghost_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
                    state.artists.push({
                        id: ghostId,
                        name: item.tag,
                        tag: item.tag,
                        categories: ['未分类'],
                        danbooruCount: 0,
                        createdAt: Date.now(),
                        _ghost: true
                    });
                    state.selected[ghostId] = item.weight;
                    state.selectedOrder.push(ghostId);
                    ghostCount++;
                }
            }

            renderGrid();
            renderSidebarRight();
            const msg = `导入完成: ${foundCount} 位已匹配` + (ghostCount > 0 ? `，${ghostCount} 位未找到(占位)` : '');
            showToast(msg);
        };

const refreshComposerImageFlags = (items, imageKey) => {
            if (!items.length) {
                state.composerImageFlagsReady = true;
                state.composerHasMissingImages = false;
                return;
            }
            Promise.all(items.map(async (artist) => {
                const id = String(artist.id);
                let image = state.pageImages[id];
                if (!image) image = await db.get(id);
                if (image) state.pageImages[id] = image;
                return Boolean(image);
            })).then((flags) => {
                if (state.composerImageKey !== imageKey) return;
                state.composerHasMissingImages = flags.some((hasImage) => !hasImage);
                state.composerImageFlagsReady = true;
                renderSidebarRight();
            });
        };

const sendPromptToNaiBatch = async (text) => {
            const parsed = parsePromptInput(text);
            if (parsed.length === 0) return showToast('未检测到有效的画师标签');
            const category = state.currentCategory || '未分类';
            const targetCategory = category === '全部' ? '未分类' : category;
            const selectedIds = [];
            let addedCount = 0;
            for (const item of parsed) {
                let artist = findEquivalentArtist(
                    state.artists.filter(existing => !existing._ghost),
                    { tag: item.tag, name: item.tag }
                );
                if (!artist) {
                    const id = String(Date.now() + Math.random());
                    artist = { id, name: item.tag, tag: item.tag, categories: [targetCategory], danbooruCount: 0, socialLinks: [], createdAt: Date.now() };
                    state.artists.push(artist);
                    addedCount++;
                }
                let image = state.pageImages[String(artist.id)];
                if (!image) image = await db.get(artist.id);
                if (image) state.pageImages[String(artist.id)] = image;
                if (!image) {
                    artist.categories = Array.isArray(artist.categories) ? artist.categories : ['未分类'];
                    if (!artist.categories.includes(targetCategory)) artist.categories.push(targetCategory);
                    selectedIds.push(String(artist.id));
                }
            }
            state.artists = state.artists.filter((artist) => !artist._ghost);
            await applyArtistDeduplication();
            actions.saveMeta();
            actions.saveCats();
            renderAll();
            if (!selectedIds.length) return showToast('当前画师串中的画师都已有例图');
            showToast(`已准备 ${selectedIds.length} 位无例图画师，新增 ${addedCount} 位`);
            generationApi.open({ selectedIds });
        };

export { importFromPromptText, refreshComposerImageFlags, sendPromptToNaiBatch };
