import {beforeEach,expect,it,vi} from 'vitest';
import {act,render} from '@testing-library/react';
import {ArtistGrid} from './ArtistGrid';
import {createInitialState,notify,state} from '../../app/store';

vi.mock('./thumbnails',()=>({scheduleThumbnailWarmup:vi.fn()}));
vi.mock('../../shared/components/ArchiveImage',()=>({ArchiveImage:()=>null}));

beforeEach(()=>Object.assign(state,createInitialState()));

it('renders exactly the current page with colliding legacy IDs through paging and filtering',()=>{
  state.pageSize=4;
  state.artists=Array.from({length:11},(_,i)=>({
    id:i<8?'shared':`id-${i}`,name:`Artist ${i}`,tag:`tag_${i}`,categories:[],
  }));
  const {container}=render(<ArtistGrid />);
  const names=()=>Array.from(container.querySelectorAll('#grid-container h3'),node=>node.textContent);
  for(const page of [1,2,3,2,1,3,1]) {
    act(()=>{state.page=page;notify();});
    expect(names()).toEqual(state.artists.slice((page-1)*4,page*4).map(a=>a.name));
  }
  act(()=>{state.searchQuery='Artist 1';notify();});
  expect(names()).toEqual(['Artist 1','Artist 10']);
  act(()=>{state.searchQuery='absent';notify();});
  expect(names()).toEqual([]);
  act(()=>{state.searchQuery='';notify();});
  expect(names()).toEqual(['Artist 0','Artist 1','Artist 2','Artist 3']);
});
