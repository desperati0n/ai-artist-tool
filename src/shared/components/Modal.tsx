import { useEffect, useRef, type ReactNode } from 'react';
export function Modal({title,children,onClose,width='max-w-lg'}:{title:string;children:ReactNode;onClose:()=>void;width?:string}) {
  const panel=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const previous=document.activeElement as HTMLElement|null;
    panel.current?.querySelector<HTMLElement>('input,button,textarea')?.focus();
    return ()=>previous?.focus();
  },[]);
  return <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in" onKeyDown={e=>{
    if(e.key==='Escape') onClose();
    if(e.key==='Tab') {
      const controls=[...(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not([type=file]),textarea,select,[tabindex="0"]')||[])].filter(el=>el.getClientRects().length>0);
      const first=controls[0],last=controls.at(-1);
      if(e.shiftKey && document.activeElement===first) {e.preventDefault();last?.focus();}
      else if(!e.shiftKey && document.activeElement===last) {e.preventDefault();first?.focus();}
    }
  }}><div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} /><div ref={panel} role="dialog" aria-modal="true" aria-label={title} className={`bg-white dark:bg-slate-900 w-full ${width} rounded-3xl p-6 relative z-10 shadow-2xl overflow-hidden transform transition-all max-h-[90vh] overflow-y-auto custom-scrollbar`}><h2 className="text-xl font-bold mb-5 dark:text-white">{title}</h2>{children}</div></div>;
}
