import type { Preset } from '../../shared/types';
import { actions } from '../../app/actions';
import { Button } from '../../shared/components/Button';
import { Icon } from '../../shared/components/Icon';
import { ArchiveImage } from '../../shared/components/ArchiveImage';
export function PresetCard({preset:p}:{preset:Preset}) {
  return <div role="button" tabIndex={0} aria-label={`加载预设 ${p.name}`} onClick={() => actions.toggleCardClick(p.id)} onKeyDown={e => {if(e.target===e.currentTarget && (e.key==='Enter'||e.key===' ')) {e.preventDefault();actions.toggleCardClick(p.id);}}} className="group glass-card spotlight-card rounded-2xl overflow-hidden cursor-pointer hover:shadow-xl hover:-translate-y-1 transition-all relative">
    <div className="aspect-[16/9] bg-slate-200 dark:bg-slate-800 relative"><ArchiveImage id={p.id} className="w-full h-full object-cover" /><div className="absolute inset-0 flex items-center justify-center text-slate-300 -z-10"><Icon name="image" className="w-8 h-8" /></div><div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity flex flex-col justify-center items-center gap-2 backdrop-blur-sm"><Button onClick={e => {e.stopPropagation();void actions.openEditPreset(p.id);}} className="bg-white text-slate-800 px-3 py-1.5 rounded-full text-xs font-bold hover:bg-indigo-50 hover:text-indigo-600 transition-colors flex items-center gap-1"><Icon name="edit-2" className="w-3 h-3" />编辑</Button></div></div>
    <div className="p-4"><div className="flex items-center justify-between mb-1"><h3 className="font-bold text-slate-800 dark:text-white truncate text-sm">{p.name}</h3><span className="text-[10px] bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-slate-500">{p.items.length} 组</span></div><div className="text-xs text-slate-400 truncate">包含 {p.items.length} 位画师</div></div>
  </div>;
}
