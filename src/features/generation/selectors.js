import {manager,local} from './session.js';

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const artistTag = (artist) => String(artist.tag || artist.name || '').trim();

const allArtists = () => manager().state?.artists || [];

const visibleArtists = () => {
    const q = local.search.trim().toLowerCase();
    const category = local.category;
    return allArtists().filter((artist) => {
      const categoryMatch = category === '全部' || (artist.categories || []).includes(category);
      const searchMatch = !q || `${artist.name || ''} ${artist.tag || ''} ${(artist.categories || []).join(' ')}`.toLowerCase().includes(q);
      return categoryMatch && searchMatch;
    });
  };

const chosenArtists = () => allArtists().filter((artist) => local.selected.has(String(artist.id)));

const hasExampleImage = (artist) => {
    const id = String(artist.id);
    return Boolean(artist.imageUrl || manager().state?.pageImages?.[id] || local.imageIds.has(id));
  };

const resultCount = (status) => [...local.results.values()].filter((result) => result.status === status).length;

export {esc,artistTag,allArtists,visibleArtists,chosenArtists,hasExampleImage,resultCount};
