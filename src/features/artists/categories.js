import { state } from '../../app/store.ts';
import { renderGrid, renderMainHeader, renderSidebarLeft } from '../../app/render.ts';
import { syncCategoryDockPill } from '../../shared/interactions/panels.js';
import { actions } from '../../app/actions.js';

const selectCategory = (category) => {
                if (state.currentCategory === category) return;

                state.currentCategory = category;
                state.page = 1;
                renderGrid();
                renderMainHeader();

                const list = document.querySelector('.category-list');
                if (!list) return;

                list.querySelectorAll('.category-item').forEach((item) => {
                    const itemCategory = decodeURIComponent(item.dataset.category || '');
                    const isActive = itemCategory === category;
                    item.classList.toggle('is-active', isActive);
                    item.querySelector(':scope > button:first-child')?.setAttribute('aria-current', isActive ? 'true' : 'false');
                });
                syncCategoryDockPill(true);
            };

const addCategory = () => {
                const name = prompt("新分类名称:");
                if(name && !state.categories.includes(name)) {
                    state.categories.push(name);
                    actions.saveCats();
                    renderSidebarLeft();
                }
            };

const deleteCategory = (name) => {
                if(!confirm(`删除分类 "${name}"?`)) return;
                state.categories = state.categories.filter(c => c!==name);
                state.artists.forEach(a => {
                    a.categories = a.categories.filter(c => c !== name);
                    if(a.categories.length === 0) a.categories.push('未分类');
                });
                if(state.currentCategory===name) state.currentCategory='全部';
                actions.saveCats();
                actions.saveMeta();
                renderSidebarLeft();
                renderGrid();
            };

export { selectCategory, addCategory, deleteCategory };
