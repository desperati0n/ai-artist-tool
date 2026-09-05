import type { Artist } from '../../shared/types';
import { actions } from '../../app/actions';
import { state } from '../../app/store';
import { Button } from '../../shared/components/Button';
import { Icon } from '../../shared/components/Icon';
import { ArchiveImage } from '../../shared/components/ArchiveImage';
import { getSocialIcon } from '../../shared/social';

export function ArtistCard({ artist: a }: {artist: Artist}) {
  const id=String(a.id);
  const selected=state.batchMode ? !!state.batchSelected[id] : !!state.selected[id];
  return <div id={`card-${id}`} role="button" tabIndex={0} aria-label={`选择画师 ${a.name}`} aria-pressed={selected}
    onClick={() => actions.toggleCardClick(id)} onKeyDown={e => { if(e.target===e.currentTarget && (e.key==='Enter'||e.key===' ')) { e.preventDefault(); actions.toggleCardClick(id); } }}
    className={`group glass-card spotlight-card rounded-2xl overflow-hidden cursor-pointer relative hover:-translate-y-1 hover:shadow-xl transition-all duration-300 ${selected?(state.batchMode?'batch-selected':'card-selected'):''}`}>
    <div className="artist-card-media bg-slate-200 dark:bg-slate-800">
      <ArchiveImage id={id} className="artist-card-image" />
      <div className="absolute inset-0 flex items-center justify-center text-slate-300 -z-10"><Icon name="image" className="w-8 h-8" /></div>
      <div className="absolute top-2 left-2 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded backdrop-blur-md flex items-center gap-1 z-20 font-bold"><Icon name="flame" className="w-3 h-3 text-orange-400" />{a.danbooruCount||0}</div>
      {!state.batchMode && !selected && <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity flex flex-col justify-end p-3 z-10"><div className="flex justify-end gap-2 mb-8">
        <Button aria-label={`编辑 ${a.name}`} onClick={e => {e.stopPropagation(); void actions.openEdit(id);}} className="p-2 bg-white text-slate-700 rounded-full shadow-lg hover:text-indigo-600 transition-transform hover:scale-110"><Icon name="edit-3" /></Button>
        <Button aria-label={`删除 ${a.name}`} onClick={e => {e.stopPropagation(); void actions.deleteArtist(id);}} className="p-2 bg-white text-red-500 rounded-full shadow-lg hover:bg-red-500 hover:text-white transition-transform hover:scale-110"><Icon name="trash-2" /></Button>
      </div></div>}
      <div id={`check-${id}`} className={`absolute top-2 right-2 ${state.batchMode?'bg-red-500':'bg-indigo-600'} text-white p-1 rounded-full shadow-lg z-20 animate-fade-in ${selected?'':'hidden'}`}><Icon name="check" /></div>
    </div>
    <div className="p-3 bg-white/90 dark:bg-slate-800/90 backdrop-blur border-t border-white/20">
      <h3 className="font-bold text-slate-800 dark:text-slate-100 truncate text-sm">{a.name}</h3>
      <div className="flex gap-1 mt-1 overflow-hidden items-center"><span className="text-[10px] text-slate-500 bg-slate-100 dark:bg-slate-700/50 px-1.5 rounded truncate font-mono">{a.tag}</span>
        {!!a.socialLinks?.length && <div className="flex gap-1 ml-auto overflow-x-auto scrollbar-hide flex-nowrap items-center" style={{maxWidth:'60%',paddingRight:12}}>{a.socialLinks.map(url => <a key={url} href={url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="social-link-icon flex-shrink-0" title={url}>{getSocialIcon(url)}</a>)}</div>}
      </div>
    </div>
  </div>;
}
