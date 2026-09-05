import {state,notify} from '../../app/store';
import {actions} from '../../app/actions';
import {readImageWithoutReencoding} from '../../storage/images';
import {Modal} from '../../shared/components/Modal';
import {Button} from '../../shared/components/Button';
import {showToast} from '../../shared/notifications';
export function PresetEditor() {
  const f=state.formData, editing=state.modal==='edit-preset';
  const close=()=>{state.modal=null;notify();};
  const save=async()=>{try{if(editing)await actions.updatePreset();else await actions.saveNewPreset();}catch(error){showToast(`保存失败：${String(error)}`);}};
  return <Modal title={editing?'编辑预设':'保存风格预设'} width="max-w-md" onClose={close}><div className="space-y-4"><label className="text-xs font-bold text-slate-500 uppercase block">{editing?'名称':'预设名称'}<input value={f.name||''} onChange={e=>{f.name=e.target.value;notify();}} className="w-full mt-1 p-3 rounded-xl bg-slate-100 dark:bg-slate-800 border-none" /></label><div><div className="text-xs font-bold text-slate-500 uppercase">封面图 (可选)</div><label className="mt-1 h-32 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl flex items-center justify-center cursor-pointer overflow-hidden relative">{f.imageUrl?<img src={f.imageUrl} alt="预设封面" className="w-full h-full object-cover" />:<span className="text-slate-400 text-xs">点击上传</span>}<input aria-label="上传预设封面" type="file" className="hidden" accept="image/*" onChange={async e=>{const file=e.target.files?.[0];if(!file)return;try{f.imageUrl=String(await readImageWithoutReencoding(file));notify();}catch(error){showToast(String(error));}}} /></label></div>
    {editing && <div><div className="text-xs font-bold text-slate-500 uppercase">包含画师 ({f.items?.length||0})</div><div id="modal-edit-preset-scroll" className="max-h-32 overflow-y-auto bg-slate-50 dark:bg-slate-800 rounded-xl p-2 mt-1 custom-scrollbar">{f.items?.map(item=><div key={item.id} className="text-xs py-1 px-2 border-b border-slate-200 dark:border-slate-700 last:border-0 flex justify-between"><span>{state.artists.find(a=>a.id===item.id)?.name||'Unknown'}</span><span className="font-mono text-slate-400">{item.weight}</span></div>)}</div></div>}
    </div><div className="mt-6 flex gap-3">{editing&&<><Button onClick={()=>actions.deletePreset(state.editingId)} className="px-4 py-3 rounded-xl font-bold text-red-500 hover:bg-red-50 border border-red-100">删除</Button><div className="flex-1" /></>}<Button onClick={close} className="flex-1 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-100">取消</Button><Button onClick={save} className={`flex-1 py-3 rounded-xl font-bold ${editing?'bg-indigo-600':'bg-green-500'} text-white shadow-lg`}>{editing?'更新':'保存'}</Button></div></Modal>;
}
