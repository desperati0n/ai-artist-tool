import {manager,local} from './session.js';
import {ensureStyle,render,refreshGenerationUi} from './view.js';
import {closeReviewPreview} from './review.js';
import {allArtists} from './selectors.js';
import {PLUGIN_ID} from './config.js';
import {loadImageFlags} from './images.js';

function open(options = {}) {
    if (local.running || local.reviewingBatch || [...local.results.values()].some(result => result.status === 'saving')) return;
    const managerContext = manager();
    if (!managerContext.state) {
      window.alert('未找到画师管理器状态，请从 index.html 打开此插件。');
      return;
    }
    ensureStyle();
    closeReviewPreview();
    const requestedIds = new Set((options.selectedIds || []).map((id) => String(id)));
    local.selected = new Set();
    local.results.clear();
    local.imageIds = new Set();
    local.imageFlagsReady = false;
    local.search = '';
    local.status = '';
    local.progress = 0;
    local.approvedCount = 0;
    local.paused = false;
    local.logs = [];
    const currentCategory = managerContext.state.currentCategory;
    local.category = currentCategory && (currentCategory === '全部' || currentCategory === '未分类' || (managerContext.state.categories || []).includes(currentCategory)) ? currentCategory : '全部';
    allArtists().forEach((artist) => {
      if (!requestedIds.has(String(artist.id))) return;
      if (local.category === '全部' || (artist.categories || []).includes(local.category)) local.selected.add(String(artist.id));
    });
    if (!document.getElementById(PLUGIN_ID)) {
      const root = document.createElement('div');
      root.id = PLUGIN_ID;
      document.body.appendChild(root);
    }
    render();
    loadImageFlags().then(refreshGenerationUi);
  }

function close() {
    if (local.running) {
      if (!window.confirm('批量生成仍在进行，确定停止并关闭吗？')) return;
      local.abort?.abort();
    }
    const keyInput = document.querySelector(`#${PLUGIN_ID} [data-nb-key]`);
    if (keyInput) local.key = keyInput.value.trim();
    closeReviewPreview();
    document.getElementById(PLUGIN_ID)?.remove();
  }

export {open,close};
export const generationApi = { open, close };
