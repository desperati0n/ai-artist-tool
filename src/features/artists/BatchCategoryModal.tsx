import {useState} from 'react';
import {state,notify} from '../../app/store';
import {actions} from '../../app/actions';
import {Modal} from '../../shared/components/Modal';
import {Button} from '../../shared/components/Button';
export function BatchCategoryModal() {
  const [categories,setCategories]=useState<string[]>([]);
  const close=()=>{state.modal=null;notify();};
  return <Modal title="批量添加到分类" width="max-w-sm" onClose={close}><div id="modal-batch-cat-scroll" className="max-h-60 overflow-y-auto space-y-2 mb-6 custom-scrollbar">{state.categories.map(c=><label key={c} className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer border border-slate-100 dark:border-slate-700"><input type="checkbox" className="w-5 h-5 accent-indigo-600 batch-cat-check" checked={categories.includes(c)} onChange={e=>setCategories(e.target.checked?[...categories,c]:categories.filter(x=>x!==c))} /><span className="text-sm font-bold text-slate-700 dark:text-slate-300">{c}</span></label>)}</div><div className="flex gap-3"><Button onClick={close} className="flex-1 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-100">取消</Button><Button onClick={()=>actions.batchAddCategories(categories)} className="flex-1 py-3 rounded-xl font-bold bg-indigo-600 text-white shadow-lg">确定</Button></div></Modal>;
}
