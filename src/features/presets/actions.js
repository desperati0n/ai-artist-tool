import { state } from '../../app/store.ts';
import { showToast } from '../../shared/notifications.js';
import { renderModal, renderGrid } from '../../app/render.ts';
import { db } from '../../storage/images.js';
import { actions } from '../../app/actions.js';

const openAddPresetModal = () => {
                const ids = [...new Set([
                    ...state.selectedOrder,
                    ...Object.keys(state.selected)
                ])].filter(id => id in state.selected);
                if(ids.length === 0) return showToast("请先在右侧选择画师组合");
                state.modal = 'add-preset';
                state.formData = { name: '', imageUrl: '' };
                renderModal();
            };

const saveNewPreset = async () => {
                const { name, imageUrl } = state.formData;
                if(!name) return showToast("请输入预设名称");
                const ids = [...new Set([
                    ...state.selectedOrder,
                    ...Object.keys(state.selected)
                ])].filter(id => id in state.selected);
                const id = String(Date.now());
                if(imageUrl && imageUrl.startsWith('data:')) { state.pageImages[id] = await db.put(id, imageUrl); }
                const preset = { id, name, items: ids.map(mid => ({ id: mid, weight: state.selected[mid] })), createdAt: Date.now() };
                state.presets.unshift(preset);
                actions.savePresets();
                state.modal = null; renderModal();
                if(state.viewMode === 'presets') renderGrid();
                showToast("预设已保存");
            };

const openEditPreset = async (id) => {
                id = String(id);
                const p = state.presets.find(x => x.id === id);
                if(!p) return;
                let img = state.pageImages[id];
                if(!img) img = await db.get(id);
                state.modal = 'edit-preset'; state.editingId = id;
                state.formData = { name: p.name, imageUrl: img || '', items: p.items || [] };
                renderModal();
            };

const updatePreset = async () => {
                const { name, imageUrl } = state.formData;
                if(!name) return showToast("名称不能为空");
                const id = state.editingId;
                if(imageUrl && imageUrl.startsWith('data:')) { state.pageImages[id] = await db.put(id, imageUrl); }
                state.presets = state.presets.map(p => { if(p.id === id) { return { ...p, name, items: state.formData.items }; } return p; });
                actions.savePresets();
                state.modal = null; renderModal();
                if(state.viewMode === 'presets') renderGrid();
                showToast("预设已更新");
            };

const deletePreset = async (id) => {
                if(!confirm("删除此预设？")) return;
                state.presets = state.presets.filter(p => p.id !== String(id));
                await db.delete(String(id));
                actions.savePresets();
                renderGrid(); state.modal = null; renderModal();
            };

export { openAddPresetModal, saveNewPreset, openEditPreset, updatePreset, deletePreset };
