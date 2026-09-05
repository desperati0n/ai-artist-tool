import { actions } from '../../app/actions';
import { useAppState } from '../../app/store';
import { Button } from '../../shared/components/Button';
import { Icon } from '../../shared/components/Icon';
import { toggleToolPanel } from '../../shared/interactions/panels';

export function Toolbar() {
  const s = useAppState();
  if(s.batchMode) return <div className="flex items-center gap-2 w-full animate-slide-up overflow-x-auto scrollbar-hide">
    <span className="font-bold text-slate-700 dark:text-white flex-shrink-0">已选 <span className="text-indigo-600 text-lg mx-1">{Object.keys(s.batchSelected).length}</span></span><div className="flex-1" />
    <Button onClick={actions.batchSelectAll} className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-full whitespace-nowrap">全选</Button>
    <Button onClick={actions.openBatchCategoryModal} className="px-3 py-1.5 text-xs font-bold bg-indigo-100 text-indigo-700 hover:bg-indigo-200 rounded-full whitespace-nowrap">添加分类</Button>
    {!['全部','未分类'].includes(s.currentCategory) && <Button onClick={actions.batchRemoveFromCategory} className="px-3 py-1.5 text-xs font-bold bg-orange-100 text-orange-700 hover:bg-orange-200 rounded-full whitespace-nowrap">移出当前</Button>}
    <Button onClick={actions.batchDelete} className="px-3 py-1.5 text-xs font-bold bg-red-100 text-red-600 hover:bg-red-200 rounded-full whitespace-nowrap">永久删除</Button>
    <Button onClick={actions.toggleBatchMode} className="ml-1 px-3 py-1.5 text-xs font-bold bg-slate-200 text-slate-600 hover:bg-slate-300 rounded-full whitespace-nowrap">退出</Button>
  </div>;
  return <div className="tool-header">
    {s.viewMode==='presets' ? <div className="text-sm font-semibold">风格预设</div> : <label className="tool-search"><span className="sr-only">搜索画师</span><Icon name="search" className="tool-search-icon w-4 h-4" /><input type="search" value={s.searchQuery} onChange={e => actions.handleSearch(e.target.value)} placeholder="搜索名称或 Danbooru tag" /></label>}
    <div className="tool-status">{s.viewMode==='presets'?`${s.presets.length} 个预设`:`${s.artists.length} 位画师 · ${s.currentCategory}`}</div>
    <div className="tool-actions">
      <Button onClick={() => toggleToolPanel('filters')} className="utility-button panel-toggle filter-toggle" aria-label="打开筛选面板"><Icon name="funnel" /></Button>
      <Button onClick={() => toggleToolPanel('composer')} className="utility-button panel-toggle composer-toggle" aria-label="打开 Prompt 编排"><Icon name="sliders-horizontal" /></Button>
      {s.viewMode==='artists' && <><Button onClick={actions.toggleBatchMode} className="utility-button"><Icon name="layers" /><span>批量</span></Button><Button onClick={() => actions.openEdit(null)} className="primary-button"><Icon name="plus" /><span>添加</span></Button></>}
    </div>
  </div>;
}
