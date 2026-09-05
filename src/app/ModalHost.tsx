import {createPortal} from 'react-dom';
import {useAppState} from './store';
import {ArtistEditor} from '../features/artists/ArtistEditor';
import {BatchCategoryModal} from '../features/artists/BatchCategoryModal';
import {PresetEditor} from '../features/presets/PresetEditor';
import {DanbooruModal} from '../features/artists/DanbooruModal';
export function ModalHost() {
  const s=useAppState();
  const root=document.getElementById('modal-container');
  if(!root || !s.modal) return null;
  const content=s.modal==='add'?<ArtistEditor key={s.editingId||'new'} />:s.modal==='batch-cat'?<BatchCategoryModal />:s.modal==='danbooru-update'?<DanbooruModal />:<PresetEditor key={s.editingId||'new'} />;
  return createPortal(content,root);
}
