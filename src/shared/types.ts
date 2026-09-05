export interface Artist {
  id: string;
  name: string;
  tag: string;
  categories: string[];
  danbooruCount?: number;
  socialLinks?: string[];
  createdAt?: number;
  imageUrl?: string;
  _ghost?: boolean;
}
export interface PresetItem { id: string; weight: number }
export interface Preset { id: string; name: string; items: PresetItem[]; createdAt?: number; imageUrl?: string }
export interface FormData {
  name?: string; tag?: string; categories?: string[]; imageUrl?: string;
  danbooruCount?: number | string; socialLinks?: string[]; items?: PresetItem[]; dbMode?: string;
}
export interface AppState {
  artists: Artist[]; categories: string[]; presets: Preset[];
  viewMode: 'artists' | 'presets'; searchQuery: string; currentCategory: string;
  sortMode: 'default' | 'alpha' | 'hot'; page: number; pageSize: number;
  selected: Record<string, number>; selectedOrder: string[];
  batchMode: boolean; batchSelected: Record<string, boolean>;
  promptFormat: 'webui' | 'novelai';
  pageImages: Record<string,string>; thumbnailImages: Record<string,string>;
  preloadedThumbnailIds: Set<string>; thumbnailWarmupToken: number;
  modal: null | 'add' | 'batch-cat' | 'add-preset' | 'edit-preset' | 'danbooru-update';
  editingId: string | null; formData: FormData; theme: 'light' | 'dark';
  composerImageKey: string; composerImageFlagsReady: boolean; composerHasMissingImages: boolean;
  dbUpdateRunning?: boolean; exportRunning?: boolean;
}
