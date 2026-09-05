import { state } from '../../app/store.ts';
import { renderSidebarLeft, renderGrid, renderMainHeader, updateCardVisual, renderBatchBar, renderSidebarRight } from '../../app/render.ts';
import { showToast } from '../../shared/notifications.js';

const setViewMode = (mode) => {
                state.viewMode = mode;
                state.page = 1;
                state.batchMode = false;
                state.batchSelected = {};
                renderSidebarLeft();
                renderGrid();
                renderMainHeader();
            };

const handleSearch = (val) => { state.searchQuery = val; state.page = 1; renderGrid(); };

const toggleSort = () => {
                const modes = ['default', 'alpha', 'hot'];
                state.sortMode = modes[(modes.indexOf(state.sortMode)+1)%modes.length];
                state.page = 1;
                renderSidebarLeft();
                renderGrid();
            };

const setPage = (p) => {
                state.page = p;
                renderGrid();
            };

const toggleCardClick = (id) => {
                id = String(id);
                if (state.batchMode) {
                    const newBatch = {...state.batchSelected};
                    if(newBatch[id]) delete newBatch[id]; else newBatch[id] = true;
                    state.batchSelected = newBatch;
                    updateCardVisual(id);
                    renderBatchBar();
                } else {
                    if (state.viewMode === 'presets') {
                        const p = state.presets.find(x => x.id === id);
                        if(p && p.items) {
                            p.items.forEach(item => {
                                state.selected[item.id] = item.weight || 1.0;
                                if (!state.selectedOrder.includes(item.id)) state.selectedOrder.push(item.id);
                            });
                            renderSidebarRight();
                            showToast(`已加载预设: ${p.name}`);
                        }
                    } else {
                        const newSel = {...state.selected};
                        if(newSel[id]) {
                            delete newSel[id];
                            state.selectedOrder = state.selectedOrder.filter(x => x !== id);
                        } else {
                            newSel[id] = 1.0;
                            state.selectedOrder.push(id);
                        }
                        state.selected = newSel;
                        updateCardVisual(id);
                        renderSidebarRight();
                    }
                }
            };

export { setViewMode, handleSearch, toggleSort, setPage, toggleCardClick };
