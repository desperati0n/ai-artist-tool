import {beforeEach,describe,it,expect,vi} from 'vitest';
import {render,screen,waitFor,fireEvent,within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {state,createInitialState} from './store';
import {App} from './App';
import {localArchive} from '../storage/localArchive';
import {browserDb} from '../storage/browser';
vi.mock('./bootstrap',()=>({bootstrap:async()=>{}}));
beforeEach(async()=>{
  Object.assign(state,createInitialState());
  localArchive.available=false;
  state.categories=['收藏','厚涂'];
  state.artists=[{id:'a',name:'Alpha',tag:'alpha',categories:['收藏']},{id:'b',name:'Beta',tag:'beta',categories:['厚涂']}];
  await browserDb.clear();
});
async function mount(artistName='Alpha'){render(<App />, {container:document.getElementById('app')!});await screen.findByRole('button',{name:`选择画师 ${artistName}`});return userEvent.setup();}
describe('React application workflows',()=>{
  it('selects artists, edits weights, reorders, switches format and saves/reloads a preset',async()=>{
    const user=await mount();
    await user.click(screen.getByRole('button',{name:'选择画师 Alpha'}));
    await user.click(screen.getByRole('button',{name:'选择画师 Beta'}));
    await user.click(screen.getByRole('button',{name:'提高 Alpha 权重'}));
    expect(screen.getByRole('textbox',{name:'Prompt'})).toHaveValue('1.1:: alpha ::, beta');
    await user.click(screen.getByRole('button',{name:'下移 Alpha'}));
    expect(screen.getByRole('textbox',{name:'Prompt'})).toHaveValue('beta, 1.1:: alpha ::');
    await user.click(screen.getByRole('button',{name:'切换 Prompt 格式'}));
    expect(screen.getByRole('textbox',{name:'Prompt'})).toHaveValue('beta, (alpha:1.1)');
    await user.click(screen.getByRole('button',{name:'存预设'}));
    await user.type(screen.getByRole('textbox',{name:'预设名称'}),'组合一');
    await user.click(within(screen.getByRole('dialog')).getByRole('button',{name:'保存'}));
    await waitFor(()=>expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(state.presets[0].items.map(i=>i.id)).toEqual(['b','a']);
    await user.click(screen.getByRole('button',{name:'清空 Prompt'}));
    await user.click(screen.getByRole('button',{name:'预设'}));
    await user.click(screen.getByRole('button',{name:'加载预设 组合一'}));
    expect(screen.getByRole('textbox',{name:'Prompt'})).toHaveValue('beta, (alpha:1.1)');
  });
  it('preserves selection while filtering and adds a category to selected artists',async()=>{
    const user=await mount();
    await user.click(screen.getByRole('button',{name:'选择画师 Alpha'}));
    await user.type(screen.getByRole('searchbox'),'beta');
    expect(screen.queryByRole('button',{name:'选择画师 Alpha'})).not.toBeInTheDocument();
    expect(screen.getByRole('textbox',{name:'Prompt'})).toHaveValue('alpha');
    await user.click(screen.getByRole('button',{name:'批量'}));
    await user.click(screen.getByRole('button',{name:'全选'}));
    await user.click(screen.getByRole('button',{name:'添加分类'}));
    await user.click(screen.getByRole('checkbox',{name:'收藏'}));
    await user.click(screen.getByRole('button',{name:'确定'}));
    expect(state.artists.find(a=>a.id==='b')?.categories).toEqual(['厚涂','收藏']);
  });
  it('creates and edits artists with names containing markup as plain text',async()=>{
    const user=await mount();
    await user.click(screen.getByRole('button',{name:'添加'}));
    await user.type(screen.getByRole('textbox',{name:'名称'}),'<b>画师</b>');
    await user.type(screen.getByRole('textbox',{name:/Tag/}),'new_artist');
    await user.click(screen.getByRole('button',{name:'保存'}));
    await screen.findByRole('button',{name:'选择画师 <b>画师</b>'});
    expect(document.querySelector('#grid-container h3 b')).toBeNull();
    await user.click(screen.getByRole('button',{name:'编辑 <b>画师</b>'}));
    expect(screen.getByRole('textbox',{name:'名称'})).toHaveValue('<b>画师</b>');
  });
  it('keeps a pasted draft across unrelated updates and handles an unknown artist',async()=>{
    const user=await mount();
    await user.type(screen.getByRole('textbox',{name:'Prompt'}),'alpha, 1.2:: unknown ::');
    await user.click(screen.getByRole('button',{name:'厚涂'}));
    expect(screen.getByRole('textbox',{name:'Prompt'})).toHaveValue('alpha, 1.2:: unknown ::');
    await user.click(screen.getByRole('button',{name:'导入串'}));
    expect(state.selectedOrder).toHaveLength(2);
    await screen.findByRole('button',{name:'送到生图区'});
  });
  it('renders preview labels as text even when an artist name contains markup',async()=>{
    state.artists[0].name='<img src=x onerror=alert(1)>';
    const user=await mount('<img src=x onerror=alert(1)>');
    await user.click(screen.getByRole('button',{name:'选择画师 <img src=x onerror=alert(1)>'}));
    const composerRow=document.querySelector('.artist-hover-row .cursor-default') as HTMLElement;
    fireEvent.mouseEnter(composerRow);
    await waitFor(()=>expect(document.getElementById('artist-preview-tooltip')).toHaveClass('show'));
    expect(document.querySelector('#artist-preview-tooltip img')).toBeNull();
    expect(document.getElementById('artist-preview-tooltip')).toHaveTextContent('<img src=x onerror=alert(1)>');
  });
  it('updates spotlight coordinates from the pointer and supports drawer dismissal',async()=>{
    await mount();
    const card=screen.getByRole('button',{name:'选择画师 Alpha'});
    vi.spyOn(card,'getBoundingClientRect').mockReturnValue({left:10,top:20,width:100,height:200} as DOMRect);
    fireEvent(card,new MouseEvent('pointermove',{bubbles:true,clientX:40,clientY:65}));
    expect(card.style.getPropertyValue('--spot-x')).toBe('30.00px');
    expect(card.style.getPropertyValue('--spot-y')).toBe('45.00px');
    fireEvent.click(screen.getByRole('button',{name:'打开筛选面板'}));
    expect(document.getElementById('sidebar-left-container')).toHaveClass('is-open');
    fireEvent.keyDown(document,{key:'Escape'});
    expect(document.getElementById('sidebar-left-container')).not.toHaveClass('is-open');
  });
  it('opens the NAI batch workspace with generation settings and closes it',async()=>{
    const user=await mount();
    await user.click(screen.getByRole('button',{name:'NAI 批量更新'}));
    const dialog=screen.getByRole('dialog',{name:'NAI 批量更新'});
    expect(within(dialog).getByLabelText('NovelAI API Key（仅本次会话）')).toHaveAttribute('type','password');
    expect(within(dialog).getByLabelText('NovelAI 模型')).toHaveValue('nai-diffusion-5-full');
    expect(within(dialog).getByText('每次 API 请求固定 1 张，收到结果后才提交下一张')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button',{name:'关闭'}));
    expect(screen.queryByRole('dialog',{name:'NAI 批量更新'})).not.toBeInTheDocument();
  });
});
