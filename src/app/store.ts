import { useSyncExternalStore } from 'react';
import type { AppState } from '../shared/types';

export function createInitialState(): AppState {
  return {
    artists: [], categories: [], presets: [], viewMode: 'artists', searchQuery: '',
    currentCategory: '全部', sortMode: 'default', page: 1, pageSize: 24,
    selected: {}, selectedOrder: [], batchMode: false, batchSelected: {},
    promptFormat: 'novelai', pageImages: {}, thumbnailImages: {},
    preloadedThumbnailIds: new Set(), thumbnailWarmupToken: 0,
    modal: null, editingId: null, formData: {}, theme: 'light',
    composerImageKey: '', composerImageFlagsReady: false, composerHasMissingImages: false,
  };
}

// Existing storage/actions retain a stable reference. React subscribes to committed changes.
export const state = createInitialState();
let revision = 0;
const listeners = new Set<() => void>();
export function notify() { revision++; listeners.forEach(listener => listener()); }
export function subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
export function useAppState() {
  useSyncExternalStore(subscribe, () => revision);
  return state;
}
