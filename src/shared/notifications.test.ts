import {describe,it,expect,vi} from 'vitest';
import {showToast} from './notifications';

describe('Notifications',()=>{
  it('renders dynamic messages as text and removes them after the timeout',()=>{
    vi.useFakeTimers();
    showToast('<img src=x onerror=alert(1)>');
    const root=document.getElementById('toast-container')!;
    expect(root).toHaveTextContent('<img src=x onerror=alert(1)>');
    expect(root.querySelector('img')).toBeNull();
    vi.advanceTimersByTime(2000);
    expect(root).toBeEmptyDOMElement();
  });
});
