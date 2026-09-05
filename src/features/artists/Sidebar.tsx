import { useLayoutEffect } from 'react';
import { actions } from '../../app/actions';
import { useAppState } from '../../app/store';
import { localArchive } from '../../storage/localArchive';
import { Button } from '../../shared/components/Button';
import { Icon } from '../../shared/components/Icon';
import { closeToolPanels, syncCategoryDockPill } from '../../shared/interactions/panels';
import { generationApi } from '../generation';

export function Sidebar() {
  const s = useAppState();
  const preset = s.viewMode === 'presets';
  useLayoutEffect(() => { syncCategoryDockPill(true); }, [s.currentCategory, s.categories.length, preset]);
  return <>
    <div className="p-4 border-b border-slate-200/50 dark:border-slate-700/50 space-y-3">
      <div className="flex items-center justify-between mb-2"><span className="app-identity">画师管理</span><div className="flex items-center gap-1">
        <Button onClick={() => actions.setTheme(s.theme==='dark'?'light':'dark')} className="theme-control" aria-label="切换显示主题"><Icon name={s.theme==='dark'?'sun':'moon'} /></Button>
        <Button onClick={closeToolPanels} className="panel-close" aria-label="关闭筛选面板"><Icon name="x" /></Button>
      </div></div>
      <div className="view-switch"><Button origin={false} onClick={() => actions.setViewMode('artists')} className={`flex-1 py-1.5 text-xs transition-all ${!preset?'is-active':''}`}>画师</Button><Button origin={false} onClick={() => actions.setViewMode('presets')} className={`flex-1 py-1.5 text-xs transition-all ${preset?'is-active':''}`}>预设</Button></div>
      <div className="flex items-center justify-between gap-2 text-[10px] text-slate-400"><span>{localArchive.available ? `本地存档 · data/ · ${localArchive.imageCount} 图` : '浏览器存档 · 启动 run_server.py 可迁移'}</span>{localArchive.available && localArchive.initialized && <Button onClick={actions.releaseBrowserImages} className="hover:text-red-500 whitespace-nowrap">释放旧缓存</Button>}</div>
      {!preset && <>
        <Button onClick={actions.toggleSort} className="sidebar-tool w-full py-2 px-3 flex items-center justify-between text-sm font-medium transition-colors"><div className="flex items-center gap-2"><Icon name={s.sortMode==='default'?'clock':s.sortMode==='alpha'?'arrow-up-az':'flame'} /><span>{s.sortMode==='default'?'默认':s.sortMode==='alpha'?'名称':'热度'}</span></div><Icon name="refresh-ccw" className="w-3 h-3 opacity-50" /></Button>
        <div className="flex gap-2"><Button onClick={() => document.getElementById('file-in')?.click()} className="sidebar-secondary flex-1 py-2 text-xs font-medium">导入存档</Button><Button onClick={() => actions.exportData()} className="sidebar-secondary flex-1 py-2 text-xs font-medium">导出存档</Button><input type="file" id="file-in" className="hidden" accept=".json,.zip" onChange={e => { void actions.importData(e.currentTarget.files?.[0]); e.currentTarget.value=''; }} /></div>
        <Button onClick={actions.openDanbooruUpdate} className="sidebar-primary w-full py-2 text-xs font-medium transition-all flex items-center justify-center gap-1.5 active:scale-[0.97]"><Icon name="arrow-clockwise" className="w-3.5 h-3.5" />更新数据</Button>
        <Button onClick={() => generationApi.open()} className="sidebar-secondary w-full py-2 text-xs font-medium transition-all flex items-center justify-center gap-1.5"><Icon name="wand-2" className="w-3.5 h-3.5" />NAI 批量更新</Button>
      </>}
    </div>
    {!preset ? <>
      <div className="flex-1 overflow-y-auto p-3 custom-scrollbar" id="cat-list-scroll"><div className="sidebar-label">分类</div><ul className="category-list">
        <li aria-hidden="true" className="category-dock-pill" />
        {['全部','未分类',...s.categories.filter(c => c!=='全部' && c!=='未分类')].map(category => <li key={category} data-category={encodeURIComponent(category)} className={`category-item group flex items-center transition-all ${s.currentCategory===category?'is-active':''}`}>
          <Button origin={false} onClick={() => actions.selectCategory(category)} aria-current={s.currentCategory===category?'true':'false'} className="flex-1 text-left bg-transparent truncate">{category}{category==='全部' && <span className="count float-right">{s.artists.length}</span>}</Button>
          {category!=='全部' && category!=='未分类' && <div className="category-actions flex gap-1 pr-1"><Button origin={false} onClick={() => actions.deleteCategory(category)} className="p-1.5 rounded-md text-slate-400 hover:text-red-600" aria-label={`删除分类 ${category}`}><Icon name="trash" className="w-3.5 h-3.5" /></Button></div>}
        </li>)}
      </ul></div>
      <div className="p-3 border-t border-slate-200/50 dark:border-slate-700/50"><Button onClick={actions.addCategory} className="new-category w-full py-2 text-sm transition-colors">+ 新建分类</Button></div>
    </> : <div className="flex-1 p-6 flex flex-col items-center justify-center text-slate-400 text-center text-sm"><Icon name="layout-grid" className="w-12 h-12 mb-4 opacity-30" /></div>}
  </>;
}
