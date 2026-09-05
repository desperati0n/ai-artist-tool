import {useState} from 'react';
import {state,notify} from '../../app/store';
import {danbooruFetcher} from '../../services/danbooru';
import {Modal} from '../../shared/components/Modal';
import {Button} from '../../shared/components/Button';
import {Icon} from '../../shared/components/Icon';
interface Progress {done:number;total:number;found:number;notFound:number;error:number;t0?:number}
export function DanbooruModal() {
  const [mode,setMode]=useState('incremental'), [skipUrls,setSkipUrls]=useState(false), [rate,setRate]=useState(3);
  const [running,setRunning]=useState(false),[started,setStarted]=useState(false),[logs,setLogs]=useState<string[]>([]);
  const [progress,setProgress]=useState<Progress>({done:0,total:0,found:0,notFound:0,error:0}),[current,setCurrent]=useState('');
  const percent=progress.total?progress.done/progress.total*100:0;
  const elapsed=progress.t0?(performance.now()-progress.t0)/1000:0;
  const speed=elapsed>0?progress.done/elapsed:0;
  const close=()=>{if(!running){state.modal=null;notify();}};
  const start=async()=>{
    setStarted(true);setRunning(true);state.dbUpdateRunning=true;setLogs([]);
    try{await danbooruFetcher.start({force:mode==='force',skipUrls,urlsOnly:mode==='urls_only',rateLimit:rate,concurrency:Math.min(rate+1,5),onProgress:(p:Progress,tag:string)=>{setProgress({...p});setCurrent(tag);},onLog:(text:string)=>setLogs(previous=>[...previous,`${new Date().toLocaleTimeString('zh-CN',{hour12:false})} ${text}`]),onComplete:(p:Progress)=>setProgress({...p})});}
    catch(error){setLogs(previous=>[...previous,String(error)]);}
    finally{setRunning(false);state.dbUpdateRunning=false;notify();}
  };
  return <Modal title="Danbooru 数据更新" onClose={close}><div className="mb-4 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700/30 text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2"><Icon name="shield-alert" className="w-4 h-4 mt-0.5 flex-shrink-0" /><span>请确保当前网络能够访问 danbooru.donmai.us。</span></div>
    {!started?<div id="db-config" className="space-y-4"><div><div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">更新模式</div><div className="flex gap-2">{[['incremental','仅未更新'],['force','全部更新'],['urls_only','仅补链接']].map(([value,label])=><Button key={value} origin={false} className={`db-mode-btn ${mode===value?'active':''}`} onClick={()=>setMode(value)}>{label}</Button>)}</div></div><label className="flex items-center gap-2 cursor-pointer group"><input type="checkbox" checked={skipUrls} onChange={e=>setSkipUrls(e.target.checked)} className="w-4 h-4 accent-indigo-600 rounded" /><span className="text-sm text-slate-600 dark:text-slate-400">不抓取社交链接 (仅更新热度)</span></label><label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">速率: <span className="text-indigo-600 dark:text-indigo-400">{rate}</span> 请求/秒<input aria-label="请求速率" type="range" min="1" max="6" value={rate} onChange={e=>setRate(Number(e.target.value))} className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600" /></label><div className="flex justify-between text-[10px] text-slate-400 mt-1"><span>慢 (稳定)</span><span>快 (可能触发限流)</span></div><div className="pt-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-400 dark:text-slate-500 flex gap-3 flex-wrap"><span>共 {state.artists.length} 位画师</span><span>未更新热度: <b className="text-orange-500">{state.artists.filter(a=>!(Number(a.danbooruCount)>0)).length}</b></span><span>缺社交链接: <b className="text-blue-500">{state.artists.filter(a=>Number(a.danbooruCount)>0&&!a.socialLinks?.length).length}</b></span></div><Button onClick={start} className="w-full py-3 rounded-xl font-bold bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40 active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-sm mt-4"><Icon name="rocket" />开始更新</Button></div>:<>
      <div id="db-progress" className="space-y-4"><div className="db-progress-bar"><div className="db-progress-fill" style={{width:`${percent}%`}} /></div><div className="text-center text-sm font-bold text-slate-600 dark:text-slate-300">{percent.toFixed(1)}% ({progress.done}/{progress.total})</div><div className="flex gap-2 mt-2">{[[progress.found,'匹配','text-green-500'],[progress.notFound,'未找到','text-slate-400'],[progress.error,'错误','text-red-400'],[speed.toFixed(1),'速度/s','text-indigo-500']].map(([value,label,color])=><div key={label} className="db-stat-card bg-slate-50 dark:bg-slate-800/50"><span className={`db-stat-value ${color}`}>{value}</span><span className="db-stat-label">{label}</span></div>)}</div><div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mt-1"><span>ETA {speed?`${Math.round((progress.total-progress.done)/speed)}s`:'--'} · 已用 {Math.round(elapsed)}s</span><span className="truncate ml-4 text-right db-pulse max-w-[180px]">{current}</span></div></div><div className="db-log-area mt-4" aria-live="polite">{logs.map((line,i)=><div key={i}>{line}</div>)}</div>
    </>}
    <div className="mt-5 flex gap-3">{running?<Button onClick={()=>danbooruFetcher.cancel()} className="flex-1 py-3 rounded-xl font-bold text-red-500 border border-red-200 dark:border-red-900/30 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">取消更新</Button>:<Button onClick={close} className="flex-1 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">关闭</Button>}</div>
  </Modal>;
}
