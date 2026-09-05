import {describe,it,expect} from 'vitest';
import {parsePromptInput} from './parser';
import {formatPrompt,orderedSelection,moveItem,dropItem} from './model';
import type {Artist} from '../../shared/types';
const artists:Artist[]=[{id:'a',name:'A',tag:'artist_a',categories:[]},{id:'b',name:'B',tag:'artist_b',categories:[]}];
describe('Prompt rules retained across the component migration',()=>{
  it('parses mixed NAI groups and bare artist prefixes in order',()=>{
    expect(parsePromptInput('artist:plain, 0.8::artist:a, b::, c')).toEqual([{tag:'plain',weight:1},{tag:'a',weight:0.8},{tag:'b',weight:0.8},{tag:'c',weight:1}]);
  });
  it('round trips NAI and WebUI weights',()=>{
    for(const format of ['novelai','webui'] as const){
      expect(parsePromptInput(formatPrompt(artists,{a:1.2,b:1},format))).toEqual([{tag:'artist_a',weight:1.2},{tag:'artist_b',weight:1}]);
    }
  });
  it('ignores blank inputs and normalizes invalid weights',()=>{
    expect(parsePromptInput(' , , ')).toEqual([]);
    expect(parsePromptInput('(artist:a:0), (b:1.24)')).toEqual([{tag:'a',weight:1},{tag:'b',weight:1.2}]);
  });
  it('keeps explicit order and removes stale or duplicate ids',()=>{
    expect(orderedSelection(artists,{a:1,b:2,missing:1},['b','b','old']).map(a=>a.id)).toEqual(['b','a']);
  });
  it('moves in both directions and preserves invalid moves',()=>{
    expect(moveItem(['a','b','c'],0,2)).toEqual(['b','c','a']);
    expect(moveItem(['a','b','c'],2,0)).toEqual(['c','a','b']);
    expect(moveItem(['a','b'],0,-1)).toEqual(['a','b']);
  });
  it('drop position respects both halves of the destination row',()=>{
    expect(dropItem(['a','b','c'],0,1,false)).toEqual(['a','b','c']);
    expect(dropItem(['a','b','c'],0,1,true)).toEqual(['b','a','c']);
    expect(dropItem(['a','b','c'],2,0,false)).toEqual(['c','a','b']);
    expect(dropItem(['a','b','c'],2,0,true)).toEqual(['a','c','b']);
  });
});
