import { actions } from './actions';
import { localArchive } from '../storage/localArchive';
let initialization: Promise<void> | undefined;
export function bootstrap() {
  if(!initialization) {
    initialization=actions.init();
    window.addEventListener('pagehide',()=>{
      if(!localArchive.available||localArchive.suspendWrites||!navigator.sendBeacon)return;
      try{navigator.sendBeacon('/api/save-meta',new Blob([JSON.stringify(localArchive.snapshot())],{type:'application/json'}));}catch{/* Regular saves remain active. */}
    });
  }
  return initialization!;
}
