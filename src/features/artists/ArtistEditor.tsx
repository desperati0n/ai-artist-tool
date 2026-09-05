import { state, notify } from '../../app/store';
import { actions } from '../../app/actions';
import { readImageWithoutReencoding } from '../../storage/images';
import { Button } from '../../shared/components/Button';
import { Modal } from '../../shared/components/Modal';
import { getSocialIcon } from '../../shared/social';
import { showToast } from '../../shared/notifications';
const inputClass='w-full mt-1 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border-none text-sm dark:text-white focus:ring-2 focus:ring-indigo-500 transition-shadow';
const labelClass='text-xs font-bold text-slate-500 uppercase tracking-wider';
export function ArtistEditor() {
  const f=state.formData;
  const close=()=>{state.modal=null;notify();};
  return <Modal title={state.editingId?'编辑画师':'添加画师'} onClose={close}>
    <div className="space-y-4"><div className="flex gap-4">
      <label className={`flex-1 ${labelClass}`}>名称<input value={f.name||''} onChange={e=>{f.name=e.target.value;notify();}} className={inputClass} /></label>
      <label className={`flex-1 ${labelClass}`}>Tag <span className="text-red-500">*</span><input required value={f.tag||''} onChange={e=>{f.tag=e.target.value;notify();}} className={`${inputClass} font-mono`} /></label>
    </div><div><div className={`${labelClass} mb-2 block`}>所属分类 (多选)</div><div id="modal-add-cat-scroll" className="flex flex-wrap gap-2 max-h-32 overflow-y-auto custom-scrollbar p-1">{state.categories.map(category=>{
      const active=f.categories?.includes(category);
      return <Button key={category} aria-pressed={!!active} onClick={()=>{f.categories=active?(f.categories||[]).filter(c=>c!==category):[...(f.categories||[]),category];notify();}} className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${active?'bg-indigo-600 text-white border-indigo-600':'bg-slate-100 dark:bg-slate-800 text-slate-500 border-transparent hover:bg-slate-200'}`}>{category}</Button>;
    })}</div></div><div className="flex gap-4">
      <label className={`flex-1 ${labelClass}`}>热度<input type="number" value={f.danbooruCount||0} onChange={e=>{f.danbooruCount=e.target.value;notify();}} className={inputClass} /></label>
      <div className="flex-[2]"><div className={labelClass}>封面</div><label className="mt-1 h-12 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl flex items-center justify-center cursor-pointer relative overflow-hidden group hover:border-indigo-500 transition-colors"><span className={`text-xs ${f.imageUrl?'text-green-500 font-bold':'text-slate-400'}`}>{f.imageUrl?'已选择图片 (点击更换)':'点击上传封面'}</span><input aria-label="上传画师封面" type="file" className="hidden" accept="image/*" onChange={async e=>{const file=e.target.files?.[0];if(!file)return;try{f.imageUrl=String(await readImageWithoutReencoding(file));notify();}catch(error){showToast(String(error));}}} /></label></div>
    </div><label className={`${labelClass} block`}>社交链接 <span className="text-[10px] text-slate-400 font-normal normal-case">每行一个 URL</span><textarea className={`${inputClass} font-mono resize-none`} rows={3} defaultValue={(f.socialLinks||[]).join('\n')} placeholder={'https://twitter.com/...\nhttps://www.pixiv.net/users/...\nhttps://example.com/'} onChange={e=>{f.socialLinks=e.target.value.split('\n').map(s=>s.trim()).filter(Boolean);}} /></label>
    {!!f.socialLinks?.length && <div className="flex gap-1 mt-1.5 flex-wrap">{f.socialLinks.map(url=><a key={url} href={url} target="_blank" rel="noopener noreferrer" className="social-link-icon" title={url}>{getSocialIcon(url)}</a>)}</div>}
    </div><div className="mt-8 flex gap-3"><Button onClick={close} className="flex-1 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">取消</Button><Button onClick={()=>actions.saveArtist().catch(error=>showToast(`保存失败：${error.message}`))} className="flex-1 py-3 rounded-xl font-bold bg-indigo-600 text-white shadow-lg shadow-indigo-500/30 hover:bg-indigo-700 transition-colors">保存</Button></div>
  </Modal>;
}
