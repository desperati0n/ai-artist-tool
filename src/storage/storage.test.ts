import {beforeEach,describe,expect,it,vi} from 'vitest';
import {waitFor} from '@testing-library/react';
import {state,createInitialState} from '../app/store';
import {actions} from '../app/actions';
import {browserDb} from './browser';
import {db} from './images';
import {localArchive} from './localArchive';
import {applyArtistDeduplication} from '../features/artists/identity';

beforeEach(async()=>{
  Object.assign(state,createInitialState());
  Object.assign(localArchive,{available:false,initialized:false,suspendWrites:false,imageIndex:new Map(),saveTimer:null,saveChain:Promise.resolve(),lastError:null});
  await browserDb.clear();
});
describe('Storage compatibility',()=>{
  it('round trips original image data and invalidates the thumbnail after replacement',async()=>{
    await db.put('a','data:image/png;base64,AAA');
    state.thumbnailImages.a='old';
    await db.put('a','data:image/png;base64,BBB');
    expect(await db.get('a')).toBe('data:image/png;base64,BBB');
    expect(state.thumbnailImages.a).toBeUndefined();
    await db.delete('a');expect(await db.get('a')).toBeNull();
  });
  it('merges duplicate identities while preserving image and preset references',async()=>{
    state.artists=[{id:'keep',name:'A (apple)',tag:'A(apple)',categories:['收藏']},{id:'old',name:'A_(apple)',tag:'A_(apple)',categories:['厚涂']}];
    state.presets=[{id:'p',name:'组合',items:[{id:'old',weight:1.3}]}];
    state.selected={old:1.3};state.selectedOrder=['old'];
    await db.put('old','data:image/png;base64,AAA');
    expect(await applyArtistDeduplication()).toBe(1);
    expect(state.artists).toHaveLength(1);
    expect(state.artists[0].categories).toEqual(['收藏','厚涂']);
    expect(state.presets[0].items).toEqual([{id:'keep',weight:1.3}]);
    expect(state.selectedOrder).toEqual(['keep']);
    expect(await db.get('keep')).toBe('data:image/png;base64,AAA');
  });
  it('imports old JSON and remaps colliding ids without losing the existing cover',async()=>{
    state.artists=[{id:'same',name:'Existing',tag:'existing',categories:['收藏']}];
    await db.put('same','data:image/png;base64,OLD');
    const data={artists:[{id:'same',name:'New',tag:'new',categories:['测试']}],presets:[{id:'p',name:'新预设',items:[{id:'same',weight:1.2}]}]};
    await actions.importData(new File([JSON.stringify(data)],'backup.json',{type:'application/json'}));
    await waitFor(()=>expect(state.presets).toHaveLength(1));
    const imported=state.artists.find(a=>a.tag==='new')!;
    expect(imported.id).not.toBe('same');
    expect(state.presets[0].items[0].id).toBe(imported.id);
    expect(await db.get('same')).toBe('data:image/png;base64,OLD');
  });
  it('serializes local metadata saves and excludes image bytes and ghost artists',async()=>{
    state.artists=[{id:'a',name:'A',tag:'a',categories:[],imageUrl:'data:large'},{id:'ghost',name:'Ghost',tag:'g',categories:[],_ghost:true}];
    localArchive.available=true;
    const fetchMock=vi.fn().mockResolvedValue({ok:true,json:async()=>({success:true})});
    vi.stubGlobal('fetch',fetchMock);
    await localArchive.flush();
    expect(fetchMock).toHaveBeenCalled();
    const saved=JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(saved.artists).toEqual([{id:'a',name:'A',tag:'a',categories:[]}]);
  });
  it('loads the existing browser storage keys without migrating to a different origin',async()=>{
    localStorage.setItem('nai-v12-meta',JSON.stringify([{id:'a',name:'A',tag:'a',categories:['收藏']}]));
    localStorage.setItem('nai-v12-cats','["收藏"]');
    localStorage.setItem('nai-v12-theme','dark');
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:false,status:404}));
    await actions.init();
    expect(state.artists[0].tag).toBe('a');expect(state.categories).toEqual(['收藏']);expect(state.theme).toBe('dark');
    expect(localArchive.available).toBe(false);
  });
});
