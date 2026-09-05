import { useEffect, useState } from 'react';
import { actions } from './actions';
import { state } from './store';
import { Sidebar } from '../features/artists/Sidebar';
import { Toolbar } from '../features/artists/Toolbar';
import { ArtistGrid } from '../features/artists/ArtistGrid';
import { Composer } from '../features/composer/Composer';
import { ModalHost } from './ModalHost';
import { Button } from '../shared/components/Button';
import { Icon } from '../shared/components/Icon';
import { closeToolPanels } from '../shared/interactions/panels';
import { syncSpotlightPointer } from '../shared/interactions/spotlight';
import { bootstrap } from './bootstrap';

export function App() {
  const [ready,setReady]=useState(false);
  const [error,setError]=useState('');
  useEffect(()=>{
    let active=true;
    void bootstrap().then(()=>{if(active)setReady(true);}).catch(error=>{if(active)setError(String(error));});
    document.addEventListener('pointermove',syncSpotlightPointer,{passive:true});
    const escape=(event:KeyboardEvent)=>{if(event.key==='Escape')closeToolPanels();};
    document.addEventListener('keydown',escape);
    return ()=>{active=false;document.removeEventListener('pointermove',syncSpotlightPointer);document.removeEventListener('keydown',escape);};
  },[]);
  if(error) return <div role="alert" className="p-6">无法读取存档：{error}</div>;
  if(!ready) return <div role="status" className="p-6">正在读取存档…</div>;
  return <>
    <div className="md:hidden h-12 bg-white dark:bg-[#202020] flex items-center justify-between px-3 border-b border-[#e6e6e6] dark:border-[#373737] flex-shrink-0"><span className="text-sm font-semibold">画师管理</span><Button className="theme-control" aria-label="切换显示主题" onClick={()=>actions.setTheme(state.theme==='dark'?'light':'dark')}><Icon name="moon" /></Button></div>
    <div className="layout-container">
      <aside className="sidebar-left glass-panel flex flex-col" id="sidebar-left-container" aria-label="视图和分类"><Sidebar /></aside>
      <main className="main-area glass-panel shadow-lg flex flex-col"><div id="main-header" className="h-16 flex items-center justify-between px-6 border-b border-slate-200/50 dark:border-slate-700/50 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md z-10 flex-shrink-0"><Toolbar /></div><ArtistGrid /></main>
      <aside className="sidebar-right glass-panel flex flex-col" id="sidebar-right-container" aria-label="Prompt 编排"><Composer /></aside>
      <Button origin={false} id="panel-scrim" className="panel-scrim" onClick={closeToolPanels} aria-label="关闭侧边面板" />
    </div>
    <ModalHost />
  </>;
}
