import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
import {afterEach,beforeEach,vi} from 'vitest';
import {cleanup} from '@testing-library/react';

beforeEach(()=>{
  document.body.innerHTML='<div id="app"></div><div id="modal-container"></div><div id="toast-container"></div><div id="artist-preview-tooltip"></div>';
  localStorage.clear();
  vi.stubGlobal('ResizeObserver',class {observe(){} unobserve(){} disconnect(){}});
  vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockImplementation(()=>new Proxy({}, {get:()=>()=>{}}) as CanvasRenderingContext2D);
});
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();vi.useRealTimers();});
