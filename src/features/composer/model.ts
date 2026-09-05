import type { Artist } from '../../shared/types';
export function orderedSelection(artists: Artist[], selected: Record<string,number>, order: string[]) {
  const ids=[...new Set([...order,...Object.keys(selected)])].filter(id => id in selected);
  return ids.flatMap(id => {const artist=artists.find(a => a.id===id);return artist?[artist]:[];});
}
export function formatPrompt(items: Artist[], selected: Record<string,number>, format: 'webui'|'novelai') {
  return items.map(a => { const weight=selected[a.id]; return weight===1 ? a.tag : format==='webui' ? `(${a.tag}:${weight.toFixed(1)})` : `${weight.toFixed(1)}:: ${a.tag} ::`; }).join(', ');
}
export function moveItem(order: string[], from: number, to: number) {
  if(from<0 || from>=order.length || to<0 || to>=order.length) return order;
  const result=[...order]; const [item]=result.splice(from,1); result.splice(to,0,item); return result;
}
export function dropItem(order: string[], from: number, target: number, below: boolean) {
  if(from<0 || from>=order.length || target<0 || target>=order.length || from===target) return order;
  let insertion=target+(below?1:0);
  if(from<insertion) insertion--;
  return moveItem(order,from,insertion);
}
