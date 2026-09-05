import {DEFAULTS} from './config.js';
import {state} from '../../app/store.ts';
import {actions} from '../../app/actions.js';
import {db} from '../../storage/images.js';

const local = {
    selected: new Set(),
    results: new Map(),
    imageIds: new Set(),
    imageFlagsReady: false,
    settings: { ...DEFAULTS },
    search: '',
    running: false,
    reviewingBatch: false,
    approvedCount: 0,
    paused: false,
    abort: /** @type {AbortController | null} */ (null),
    key: '',
    status: '',
    progress: 0,
    category: '全部',
    logs: []
  };

const manager = () => ({state,actions,db});

export {local,manager};
