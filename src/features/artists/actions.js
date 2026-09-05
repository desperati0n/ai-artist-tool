import { state } from '../../app/store.ts';
import { db } from '../../storage/images.js';
import { renderModal, renderAll } from '../../app/render.ts';
import { showToast } from '../../shared/notifications.js';
import { findEquivalentArtist } from '../../shared/artistIdentity.js';
import { actions } from '../../app/actions.js';
import { hideArtistPreview } from '../composer/preview.js';

const openEdit = async (id) => {
                id = String(id);
                const a = state.artists.find(x => String(x.id)===id);
                let img = '';
                if(a) {
                    img = state.pageImages[id];
                    if(!img) img = await db.get(id);
                }
                state.modal = 'add';
                state.editingId = id && id !== 'null' ? id : null;
                state.formData = {
                    name: a ? a.name : '',
                    tag: a ? a.tag : '',
                    categories: a ? [...a.categories] : ['未分类'],
                    imageUrl: img || '',
                    danbooruCount: a ? a.danbooruCount : 0,
                    socialLinks: a ? (a.socialLinks || []) : []
                };
                renderModal();
            };

const saveArtist = async () => {
                const { name, tag, categories, imageUrl, danbooruCount, socialLinks } = state.formData;
                if(!tag) return showToast("Tag 必填");
                const id = state.editingId ? String(state.editingId) : String(Date.now());
                let finalCats = categories && categories.length > 0 ? categories : ['未分类'];
                const newMeta = {
                    id, name: name||tag, tag, categories: finalCats,
                    danbooruCount: parseInt(danbooruCount)||0,
                    socialLinks: Array.isArray(socialLinks) ? socialLinks.filter(u => u.trim()) : [],
                    createdAt: state.editingId ? (state.artists.find(a=>String(a.id)===id)?.createdAt||Date.now()) : Date.now()
                };
                const duplicate = findEquivalentArtist(state.artists, newMeta, state.editingId ? id : null);
                if (duplicate) return showToast(`画师已存在：${duplicate.name || duplicate.tag}`);

                if(imageUrl && imageUrl.startsWith('data:')) {
                    state.pageImages[id] = await db.put(id, imageUrl);
                }

                if(state.editingId) {
                    state.artists = state.artists.map(a => String(a.id)===id ? newMeta : a);
                } else {
                    state.artists.unshift(newMeta);
                    state.sortMode = 'default';
                    state.currentCategory = '全部';
                    state.page = 1;
                    state.searchQuery = '';
                }

                state.modal = null;
                actions.saveMeta();
                renderModal();
                renderAll();
                showToast(state.editingId ? "更新成功" : "添加成功");
            };

const deleteArtist = async (id) => {
                id = String(id);
                if(!confirm("确定要删除这位画师吗？")) return;

                try { await db.delete(id); } catch(e) { console.warn('DB delete error:', e); }
                state.artists = state.artists.filter(a => String(a.id) !== id);

                // 清理所有选中状态
                delete state.selected[id];
                delete state.batchSelected[id];
                delete state.pageImages[id];

                // 隐藏可能存在的预览提示
                hideArtistPreview();


                actions.saveMeta();
                try { renderAll(); } catch(e) { console.error('Render error after delete:', e); }
                showToast("已删除");
            };

const openDanbooruUpdate = () => {
                if (state.artists.length === 0) return showToast('请先导入画师数据');
                state.modal = 'danbooru-update';
                state.formData = { dbMode: 'incremental' };
                state.dbUpdateRunning = false;
                renderModal();
            };

export { openEdit, saveArtist, deleteArtist, openDanbooruUpdate };
