import { useEffect, useState } from 'react';
import { state } from '../../app/store';
import { db } from '../../storage/images';

export function ArchiveImage({ id, className }: { id: string; className: string }) {
  const cached = state.thumbnailImages[id];
  const [source,setSource] = useState<string | undefined>(cached);
  const original = state.pageImages[id];
  useEffect(() => {
    let active = true;
    setSource(state.thumbnailImages[id]);
    void db.get(id,{thumbnail:true}).then(image => {
      if (active && typeof image==='string') {
        state.thumbnailImages[id]=image;
        setSource(image);
      }
    });
    return () => { active=false; };
  },[id, original, cached]);
  return <img id={`img-${id}`} src={source || undefined} alt="" className={`${className} transition-opacity duration-500 ${source?'':'opacity-0'}`} loading="eager" decoding="async" />;
}
