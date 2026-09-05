import { useEffect, useRef } from 'react';
import { useAppState } from '../../app/store';
import { actions } from '../../app/actions';
import { getFilteredList } from './selectors';
import { scheduleThumbnailWarmup } from './thumbnails';
import { ArtistCard } from './ArtistCard';
import { PresetCard } from '../presets/PresetCard';
import { Button } from '../../shared/components/Button';
import { Icon } from '../../shared/components/Icon';
import type { Artist, Preset } from '../../shared/types';

export function ArtistGrid() {
  const s=useAppState();
  const list=getFilteredList();
  const totalPage=Math.ceil(list.length/s.pageSize)||1;
  const page=Math.max(1,Math.min(s.page,totalPage));
  const items=list.slice((page-1)*s.pageSize,page*s.pageSize);
  const container=useRef<HTMLDivElement>(null);
  const filterKey=[page,s.pageSize,s.currentCategory,s.viewMode,s.searchQuery,s.sortMode].join('|');
  useEffect(() => {s.page=page; if(container.current) container.current.scrollTop=0; scheduleThumbnailWarmup(list,items);},[filterKey]);
  return <>
    <div ref={container} id="grid-container" className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-slate-50/50 dark:bg-slate-900/20">
      {items.length===0 ? <div className="h-full flex flex-col items-center justify-center text-slate-400"><Icon name={s.viewMode==='presets'?'package-open':'ghost'} className="empty-state-icon opacity-30" /><p>{s.viewMode==='presets'?'暂无预设，请在右侧保存':'没有数据'}</p></div> : <div className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 ${s.viewMode==='artists'?'xl:grid-cols-6':''} gap-4 pb-4`}>{items.map(item => s.viewMode==='artists'?<ArtistCard key={item.id} artist={item as Artist} />:<PresetCard key={item.id} preset={item as Preset} />)}</div>}
    </div>
    <div id="pagination-container" className="h-12 border-t border-slate-200/50 dark:border-slate-700/50 flex items-center justify-between px-6 bg-white/60 dark:bg-slate-900/60 text-sm flex-shrink-0">
      <span className="text-slate-500">Total: {list.length} {s.viewMode==='artists'?'Artists':'Presets'}</span>
      <div className="flex items-center gap-2"><Button onClick={() => actions.setPage(page-1)} disabled={page===1} aria-label="上一页" className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg disabled:opacity-30"><Icon name="chevron-left" className="w-5 h-5 dark:text-white" /></Button><span className="font-mono font-bold dark:text-white w-10 text-center text-base">{page}</span><Button onClick={() => actions.setPage(page+1)} disabled={page===totalPage} aria-label="下一页" className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg disabled:opacity-30"><Icon name="chevron-right" className="w-5 h-5 dark:text-white" /></Button></div>
    </div>
  </>;
}
