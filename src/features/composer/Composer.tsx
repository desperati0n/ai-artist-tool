import { useEffect, useRef, useState } from 'react';
import type { DragEvent } from 'react';
import { actions } from '../../app/actions';
import { notify, useAppState } from '../../app/store';
import { updateCardVisual } from '../../app/render';
import { Button } from '../../shared/components/Button';
import { Icon } from '../../shared/components/Icon';
import { closeToolPanels } from '../../shared/interactions/panels';
import { showToast } from '../../shared/notifications';
import { importFromPromptText, refreshComposerImageFlags, sendPromptToNaiBatch } from './import';
import { PIE_COLORS, drawPieChart, setupPieHover } from './chart';
import { showArtistPreview, hideArtistPreview, movePreviewTooltip } from './preview';
import { orderedSelection, formatPrompt, moveItem, dropItem } from './model';

export function Composer() {
  const s=useAppState();
  const items=orderedSelection(s.artists,s.selected,s.selectedOrder);
  const generated=formatPrompt(items,s.selected,s.promptFormat);
  const [draft,setDraft]=useState(generated);
  const textarea=useRef<HTMLTextAreaElement>(null);
  const listRef=useRef<HTMLDivElement>(null);
  const dragSource=useRef(-1);
  const imageKey=items.map(a=>`${a.id}:${s.pageImages[a.id]?'1':'0'}`).join('|');
  const selectionKey=items.map(a=>`${a.id}:${s.selected[a.id]}`).join('|');
  useEffect(() => {setDraft(generated);},[generated]);
  useEffect(() => {
    s.selectedOrder=items.map(a=>a.id);
    s.composerImageKey=imageKey;
    s.composerImageFlagsReady=!items.length;
    s.composerHasMissingImages=false;
    refreshComposerImageFlags(items,imageKey);
  },[imageKey]);
  useEffect(() => {
    const canvas=document.getElementById('pie-chart-cv') as HTMLCanvasElement|null;
    if(!canvas || !items.length) return;
    const draw=() => {drawPieChart('pie-chart-cv',items);setupPieHover('pie-chart-cv',items);};
    draw();
    const observer=new ResizeObserver(draw); observer.observe(canvas);
    return () => {observer.disconnect();canvas.onmousemove=null;canvas.onmouseleave=null;hideArtistPreview();};
  },[selectionKey,s.theme]);
  const total=items.reduce((sum,a)=>sum+s.selected[a.id],0);
  const isWebui=s.promptFormat==='webui';
  const reorder=(from:number,to:number) => {s.selectedOrder=moveItem(items.map(a=>a.id),from,to);hideArtistPreview();notify();};
  const clearDrag=() => listRef.current?.querySelectorAll('.artist-drag-item').forEach(row=>row.classList.remove('dragging','drag-over-top','drag-over-bottom'));
  const over=(event:DragEvent<HTMLDivElement>) => {
    event.preventDefault();event.dataTransfer.dropEffect='move';clearDrag();
    const rect=event.currentTarget.getBoundingClientRect();
    event.currentTarget.classList.add(event.clientY<rect.top+rect.height/2?'drag-over-top':'drag-over-bottom');
  };
  const remove=(id:string) => {
    delete s.selected[id];
    s.selectedOrder=s.selectedOrder.filter(x=>x!==id);
    if(id.startsWith('_ghost_')) s.artists=s.artists.filter(a=>a.id!==id);
    hideArtistPreview();
    // Keep the grid card in sync immediately, including when the pointer is still over it.
    updateCardVisual(id);
    notify();
  };
  const copy=async () => {
    try {await navigator.clipboard.writeText(draft);showToast('咒语已复制');}
    catch {textarea.current?.select();if(document.execCommand('copy')) showToast('咒语已复制');else showToast('复制失败，请手动复制');}
  };
  return <>
    <div className="p-5 border-b border-slate-200/50 dark:border-slate-700/50 flex justify-between items-center"><h2 className="dark:text-white flex items-center gap-2"><Icon name="wand-2" />Prompt 编排</h2><div className="flex items-center gap-2"><span className="bg-indigo-100 text-indigo-600 text-xs font-semibold px-2 py-1 rounded-full">{items.length}</span><Button onClick={closeToolPanels} className="panel-close" aria-label="关闭 Prompt 编排"><Icon name="x" /></Button></div></div>
    {!!items.length && <div className="px-4 py-3 border-b border-slate-200/50 dark:border-slate-700/50 pie-canvas-wrap"><canvas id="pie-chart-cv" aria-label="画师权重占比" style={{width:'100%',height:180,display:'block',cursor:'pointer'}} /></div>}
    <div className="px-5 py-3 bg-slate-50 dark:bg-slate-800/30 border-b border-slate-200/50 dark:border-slate-700/50 flex items-center justify-between"><span className="text-xs font-medium text-slate-500">输出格式</span><div className="format-switch flex bg-slate-200 dark:bg-slate-700 p-1 w-32 relative cursor-pointer" role="button" tabIndex={0} aria-label="切换 Prompt 格式" onClick={()=>{s.promptFormat=isWebui?'novelai':'webui';notify();}} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.currentTarget.click();}}}><div className="absolute inset-y-1 w-[calc(50%-4px)] bg-white dark:bg-indigo-500 shadow-sm capsule-bg" style={{left:isWebui?'4px':'calc(50%)'}} /><div className={`flex-1 text-[10px] font-semibold text-center z-10 py-1 ${isWebui?'format-active':'format-inactive'}`}>SDXL</div><div className={`flex-1 text-[10px] font-semibold text-center z-10 py-1 ${!isWebui?'format-active':'format-inactive'}`}>NAI</div></div></div>
    <div ref={listRef} className="flex-1 overflow-y-auto p-5 space-y-2 custom-scrollbar" id="right-artist-list-scroll">
      {!items.length ? <div className="text-center text-slate-400 py-10"><Icon name="clipboard-paste" className="w-10 h-10 mx-auto mb-3 opacity-30" /><p>点击左侧卡片选择画师</p><p className="text-xs mt-1 opacity-60">或在下方文本框粘贴画师串导入</p></div> : items.map((a,index)=>{
        const id=a.id, weight=s.selected[id], ghost=!!a._ghost, color=ghost?'#94a3b8':PIE_COLORS[index%PIE_COLORS.length];
        return <div key={id} className={`flex items-center gap-1 group bg-white/50 dark:bg-slate-800/50 p-2 rounded-xl border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-all artist-hover-row artist-drag-item ${ghost?'ghost-artist':''}`} data-artist-id={id} data-artist-idx={index} draggable
          onDragStart={e=>{dragSource.current=index;e.currentTarget.classList.add('dragging');e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',String(index));hideArtistPreview();}}
          onDragEnd={()=>{dragSource.current=-1;clearDrag();}} onDragOver={over} onDragLeave={e=>e.currentTarget.classList.remove('drag-over-top','drag-over-bottom')}
          onDrop={e=>{e.preventDefault();const rect=e.currentTarget.getBoundingClientRect();s.selectedOrder=dropItem(items.map(a=>a.id),dragSource.current,index,e.clientY>=rect.top+rect.height/2);dragSource.current=-1;clearDrag();notify();}}>
          <div className="flex flex-col gap-0.5 flex-shrink-0 mr-1"><Button origin={false} aria-label={`上移 ${a.name}`} onClick={()=>reorder(index,index-1)} disabled={index===0} className="artist-move-btn"><Icon name="chevron-up" className="w-3 h-3" /></Button><Button origin={false} aria-label={`下移 ${a.name}`} onClick={()=>reorder(index,index+1)} disabled={index===items.length-1} className="artist-move-btn"><Icon name="chevron-down" className="w-3 h-3" /></Button></div>
          <div className="flex items-center flex-1 min-w-0 cursor-default" onMouseEnter={e=>{if(!ghost) void showArtistPreview(id,{clientY:e.clientY});}} onMouseMove={e=>{if(!ghost) movePreviewTooltip(e);}} onMouseLeave={hideArtistPreview}>
            <div className="w-3 h-3 rounded-full flex-shrink-0 mr-2" style={{background:color,boxShadow:`0 0 6px ${color}60`}} /><div className="flex-1 min-w-0 pr-2"><div className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{a.name}{ghost&&<span className="ghost-badge"><Icon name="help-circle" className="w-3 h-3" />未匹配</span>}</div><div className="text-xs text-slate-400 truncate font-mono mt-0.5">{a.tag} <span style={{color,fontWeight:700}}>{total>0?(weight/total*100).toFixed(1):'0'}%</span></div></div>
          </div>
          <div className="flex items-center gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-1 shadow-sm"><Button aria-label={`降低 ${a.name} 权重`} onClick={()=>{s.selected[id]=Math.max(0.1,Math.round((weight-0.1)*10)/10);notify();}} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-500 hover:text-indigo-600"><Icon name="minus" className="w-3.5 h-3.5" /></Button><span className="text-xs font-mono w-8 text-center font-bold dark:text-white">{weight.toFixed(1)}</span><Button aria-label={`提高 ${a.name} 权重`} onClick={()=>{s.selected[id]=Math.round((weight+0.1)*10)/10;notify();}} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-500 hover:text-indigo-600"><Icon name="plus" className="w-3.5 h-3.5" /></Button></div>
          <Button aria-label={`移除 ${a.name}`} onClick={()=>remove(id)} className="ml-1 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg p-1 transition-colors"><Icon name="x" /></Button>
        </div>;
      })}
    </div>
    <div className="p-5 border-t border-slate-200/50 dark:bg-slate-900/60 space-y-3 bg-white/60 backdrop-blur-md">
      <textarea ref={textarea} id="res-box" aria-label="Prompt" value={draft} onChange={e=>setDraft(e.target.value)} className="w-full h-24 text-sm p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none dark:text-slate-300 shadow-inner" placeholder="粘贴画师串到此处导入，或由选择自动生成..." />
      <div className="flex gap-2"><Button onClick={()=>importFromPromptText(draft)} className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold shadow-lg shadow-amber-500/30 flex items-center justify-center gap-1 import-prompt-btn"><Icon name="clipboard-paste" />导入串</Button><Button onClick={actions.openAddPresetModal} className="flex-1 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-xl text-xs font-bold shadow-lg shadow-green-500/30 flex items-center justify-center gap-1"><Icon name="save" />存预设</Button><Button onClick={copy} className="flex-[2] bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-500/30 flex items-center justify-center gap-2 active:scale-95 transition-transform"><Icon name="copy" />复制</Button>
        {s.composerImageFlagsReady && s.composerHasMissingImages && <Button onClick={()=>sendPromptToNaiBatch(draft)} className="flex-[1.15] bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-500/30 flex items-center justify-center gap-1"><Icon name="wand-2" />送到生图区</Button>}
        <Button aria-label="清空 Prompt" onClick={()=>{s.selected={};s.selectedOrder=[];s.artists=s.artists.filter(a=>!a._ghost);setDraft('');hideArtistPreview();notify();}} className="p-3 rounded-xl border border-red-200 text-red-500 hover:bg-red-50 hover:border-red-300 transition-colors"><Icon name="trash-2" className="w-5 h-5" /></Button>
      </div>
    </div>
  </>;
}
