import { state } from '../../app/store.ts';

const getFilteredList = () => {
            if (state.viewMode === 'presets') return state.presets;
            const search = state.searchQuery.toLowerCase();
            let list = state.artists.filter(a => {
                const matchSearch = (a.name||'').toLowerCase().includes(search) || (a.tag||'').toLowerCase().includes(search);
                const matchCat = state.currentCategory === '全部' || a.categories.includes(state.currentCategory);
                return matchSearch && matchCat;
            });
            if (state.sortMode === 'alpha') list.sort((a,b) => (a.name||'').localeCompare(b.name||''));
            else if (state.sortMode === 'hot') list.sort((a,b) => (b.danbooruCount||0) - (a.danbooruCount||0));
            else list.sort((a,b) => (b.createdAt||0) - (a.createdAt||0));
            return list;
        };

export { getFilteredList };
