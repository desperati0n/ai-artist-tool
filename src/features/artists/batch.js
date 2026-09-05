import { state } from '../../app/store.ts';
import { renderMainHeader, renderGrid, renderBatchBar, renderAll, renderModal } from '../../app/render.ts';
import { getFilteredList } from './selectors.js';
import { db } from '../../storage/images.js';
import { actions } from '../../app/actions.js';
import { showToast } from '../../shared/notifications.js';

const toggleBatchMode = () => { state.batchMode = !state.batchMode; state.batchSelected = {}; renderMainHeader(); renderGrid(); };

const batchSelectAll = () => {
                const list = getFilteredList();
                const newBatch = {...state.batchSelected};
                const allSelected = list.every(a => newBatch[a.id]);
                list.forEach(a => { if(allSelected) delete newBatch[a.id]; else newBatch[a.id] = true; });
                state.batchSelected = newBatch;
                renderGrid(); renderBatchBar();
            };

const batchDelete = async () => {
                const ids = Object.keys(state.batchSelected);
                if(ids.length === 0) return;

                if(!confirm(`确定要永久删除选中的 ${ids.length} 位画师吗？此操作将从所有分类中移除。`)) return;

                for(const id of ids) await db.delete(id);

                // 全局删除：直接过滤掉 ID 在选中列表里的画师
                state.artists = state.artists.filter(a => !state.batchSelected[String(a.id)]);

                // 清理选中态
                const newSel = {...state.selected};
                ids.forEach(id => delete newSel[id]);
                state.selected = newSel;

                state.batchSelected = {};
                state.batchMode = false;

                actions.saveMeta();
                renderAll(); // 刷新所有视图
                showToast("批量删除成功");
            };

const batchRemoveFromCategory = () => {
                const cat = state.currentCategory;
                if(cat === '全部' || cat === '未分类') return showToast("请使用批量删除功能");

                const ids = Object.keys(state.batchSelected);
                if(ids.length === 0) return;

                if(!confirm(`确定将选中的 ${ids.length} 位画师移出 "${cat}" 分类吗？`)) return;

                state.artists = state.artists.map(a => {
                    if(state.batchSelected[String(a.id)]) {
                        // 移除当前分类
                        const newCats = a.categories.filter(c => c !== cat);
                        // 如果没有分类了，归为未分类
                        if(newCats.length === 0) newCats.push('未分类');
                        return { ...a, categories: newCats };
                    }
                    return a;
                });

                state.batchSelected = {};
                state.batchMode = false;
                actions.saveMeta();
                renderAll();
                showToast("已移出分类");
            };

const openBatchCategoryModal = () => {
                if(Object.keys(state.batchSelected).length === 0) return showToast("请先选择画师");
                state.modal = 'batch-cat';
                renderModal();
            };

const batchAddCategories = (cats) => {
                state.artists = state.artists.map(a => {
                    if(state.batchSelected[String(a.id)]) {
                        const newCats = [...new Set([...a.categories, ...cats])];
                        return { ...a, categories: newCats };
                    }
                    return a;
                });
                actions.saveMeta();
                state.modal = null;
                state.batchMode = false;
                state.batchSelected = {};
                renderModal(); renderAll();
                showToast(`分类已更新`);
            };

export { toggleBatchMode, batchSelectAll, batchDelete, batchRemoveFromCategory, openBatchCategoryModal, batchAddCategories };
