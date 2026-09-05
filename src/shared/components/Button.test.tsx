import {render,screen,fireEvent} from '@testing-library/react';
import {describe,it,expect,vi} from 'vitest';
import {Button} from './Button';
import {originPoint} from '../interactions/origin';

describe('Original button fill interaction',()=>{
  it('covers all four corners from the actual pointer position',()=>{
    const point=originPoint(100,40,10,20);
    expect(point).toEqual({x:10,y:20,size:185});
    expect(originPoint(100,40,-10,90)).toEqual({x:0,y:40,size:216});
  });
  it('supports keyboard presses and keeps exactly one content wrapper after updates',()=>{
    const click=vi.fn();
    const {rerender}=render(<Button onClick={click}>保存</Button>);
    const button=screen.getByRole('button',{name:'保存'});
    fireEvent.keyDown(button,{key:'Enter'});
    expect(button).toHaveClass('is-origin-active');
    expect(button).toHaveAttribute('data-origin-pressed','true');
    rerender(<Button onClick={click}>更新</Button>);
    expect(button.querySelectorAll('.origin-button__content')).toHaveLength(1);
    fireEvent.click(button);expect(click).toHaveBeenCalledOnce();
    fireEvent.blur(button);expect(button).not.toHaveClass('is-origin-active');
  });
  it('leaves custom category and move controls unwrapped and disabled buttons inactive',()=>{
    render(<><Button origin={false}>分类</Button><Button disabled>禁用</Button></>);
    expect(screen.getByRole('button',{name:'分类'})).not.toHaveClass('origin-button');
    fireEvent.keyDown(screen.getByRole('button',{name:'禁用'}),{key:'Enter'});
    expect(screen.getByRole('button',{name:'禁用'})).not.toHaveClass('is-origin-active');
  });
});
