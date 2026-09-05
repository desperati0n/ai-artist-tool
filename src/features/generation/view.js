import {STYLE_ID,PLUGIN_ID,MODEL_OPTIONS} from './config.js';
import {local,manager} from './session.js';
import {close} from './index.js';
import {visibleArtists,hasExampleImage,chosenArtists,resultCount,esc,allArtists} from './selectors.js';
import {run} from './queue.js';
import {copyLogs,renderLogPanel} from './logs.js';
import {openReviewPreview,settleReview,exportManagerData} from './review.js';

function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${PLUGIN_ID}{position:fixed;inset:0;z-index:160;display:flex;align-items:center;justify-content:center;padding:1rem;background:rgba(16,18,20,.42);backdrop-filter:blur(3px);font-family:inherit;color:var(--nt-ink,#31302e)}
      #${PLUGIN_ID} .nb-window{width:min(1180px,96vw);height:min(880px,94vh);display:flex;flex-direction:column;background:var(--nt-surface,#fff);border:1px solid var(--nt-line,#dedbd7);border-radius:var(--nt-radius-lg,18px);box-shadow:0 24px 70px rgba(0,0,0,.24);overflow:hidden}
      #${PLUGIN_ID} .nb-head{display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:.95rem 1.1rem;border-bottom:1px solid var(--nt-line,#dedbd7);background:var(--nt-surface,#fff)}
      #${PLUGIN_ID} .nb-title{font-size:1rem;font-weight:700;letter-spacing:-.01em}.nb-sub{font-size:.72rem;color:var(--nt-faint,#8c8984);margin-top:.14rem}
      #${PLUGIN_ID} .nb-close{border:1px solid var(--nt-line,#dedbd7);background:transparent;color:var(--nt-faint,#8c8984);border-radius:var(--nt-radius-sm,8px);padding:.42rem .58rem;cursor:pointer}.nb-close:hover{background:var(--nt-surface-hover,#f3f1ef);color:var(--nt-ink,#31302e)}
      #${PLUGIN_ID} .nb-body{display:grid;grid-template-columns:280px minmax(300px,1fr) 340px;min-height:0;flex:1}.nb-col{min-width:0;min-height:0;border-right:1px solid var(--nt-line,#dedbd7);display:flex;flex-direction:column}.nb-col:last-child{border-right:0}.nb-col:last-child>.nb-scroll{flex:1}.nb-col-title{padding:.72rem .9rem;font-size:.72rem;font-weight:700;color:var(--nt-faint,#8c8984);border-bottom:1px solid var(--nt-line,#dedbd7);text-transform:uppercase;letter-spacing:.06em}.nb-scroll{overflow:auto;min-height:0}.nb-pad{padding:.8rem .9rem}.nb-field{display:block;margin-bottom:.7rem}.nb-label{display:block;font-size:.68rem;font-weight:700;color:var(--nt-faint,#8c8984);margin-bottom:.28rem}.nb-input,#${PLUGIN_ID} textarea,#${PLUGIN_ID} select{width:100%;padding:.48rem .58rem;border:1px solid var(--nt-line,#dedbd7);border-radius:var(--nt-radius-sm,8px);background:var(--nt-canvas,#f6f5f4);color:var(--nt-ink,#31302e);font:inherit;font-size:.78rem;outline:none}#${PLUGIN_ID} textarea{resize:vertical;min-height:62px}#${PLUGIN_ID} input:focus,#${PLUGIN_ID} textarea:focus,#${PLUGIN_ID} select:focus{border-color:var(--nt-primary,#596554);box-shadow:0 0 0 2px color-mix(in srgb,var(--nt-primary,#596554) 18%,transparent)}
      #${PLUGIN_ID} .nb-two{display:grid;grid-template-columns:1fr 1fr;gap:.55rem}.nb-check{display:flex;gap:.42rem;align-items:center;font-size:.75rem;color:var(--nt-ink,#31302e);margin:.48rem 0}.nb-check input{accent-color:var(--nt-primary,#596554)}
      #${PLUGIN_ID} .nb-note{font-size:.68rem;line-height:1.45;color:var(--nt-faint,#8c8984);padding:.55rem .62rem;background:var(--nt-canvas,#f6f5f4);border-radius:var(--nt-radius-sm,8px)}
      #${PLUGIN_ID} .nb-toolbar{position:relative;display:flex;align-items:center;gap:.45rem;flex-wrap:wrap;padding:.65rem .8rem;border-bottom:1px solid var(--nt-line,#dedbd7)}#${PLUGIN_ID} .nb-toolbar input{flex:1;min-width:150px}.nb-category-slot{position:relative;z-index:25;flex:0 0 2.6rem;width:2.6rem;height:2.6rem}.nb-category-menu{position:absolute;left:0;top:0;width:2.6rem;height:2.6rem;overflow:hidden;border:1px solid color-mix(in srgb,var(--nt-line,#dedbd7) 88%,var(--nt-ink,#31302e));border-radius:6px;background:color-mix(in srgb,var(--nt-surface,#fff) 96%,transparent);box-shadow:0 7px 17px rgba(34,33,31,.11),0 1px 2px rgba(34,33,31,.08),inset 0 1px 0 rgba(255,255,255,.78);backdrop-filter:blur(10px);will-change:width,height,border-radius;transition:width .34s cubic-bezier(.22,1,.36,1),height .4s cubic-bezier(.22,1,.36,1),border-radius .3s ease,box-shadow .3s ease}.nb-category-menu.open{width:10.5rem;height:var(--nb-category-height,16rem);border-radius:8px;box-shadow:0 16px 36px rgba(34,33,31,.18),0 3px 8px rgba(34,33,31,.08),inset 0 1px 0 rgba(255,255,255,.82)}.nb-category-toggle{display:flex;width:100%;height:2.55rem;align-items:center;justify-content:center;gap:.42rem;padding:0;border:0;background:transparent;color:var(--nt-ink,#31302e);font:inherit;font-size:.67rem;font-weight:750;letter-spacing:0;cursor:pointer;white-space:nowrap;outline:none;transition:padding .25s cubic-bezier(.22,1,.36,1)}.nb-category-menu.open .nb-category-toggle{justify-content:flex-start;padding:0 .72rem}.nb-category-toggle:focus-visible{box-shadow:inset 0 0 0 2px color-mix(in srgb,var(--nt-primary,#596554) 44%,transparent)}.nb-category-current{max-width:0;overflow:hidden;color:var(--nt-faint,#8c8984);font-weight:600;opacity:0;text-overflow:ellipsis;transition:max-width .28s cubic-bezier(.22,1,.36,1),opacity .16s ease}.nb-category-menu.open .nb-category-current{max-width:7rem;opacity:1}.nb-category-list-wrap{height:calc(100% - 2.55rem);min-height:0;padding:.12rem .3rem .35rem;opacity:0;transform:translateY(-7px);clip-path:inset(0 0 100% 0 round 6px);pointer-events:none;transition:opacity .18s ease,transform .32s cubic-bezier(.22,1,.36,1),clip-path .36s cubic-bezier(.22,1,.36,1)}.nb-category-menu.open .nb-category-list-wrap{opacity:1;transform:translateY(0);clip-path:inset(0 0 0 0 round 6px);pointer-events:auto;transition-delay:.06s}.nb-category-list{height:100%;overflow-y:auto;overscroll-behavior:contain;scrollbar-width:thin}.nb-category-option{display:block;width:100%;min-height:2rem;padding:.43rem .56rem;border:0;border-radius:4px;background:transparent;color:var(--nt-ink,#31302e);font:inherit;font-size:.71rem;font-weight:560;letter-spacing:0;text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer;outline:none;transition:background-color .14s ease,color .14s ease,transform .14s ease}.nb-category-option:hover,.nb-category-option:focus-visible{background:var(--nt-surface-hover,#f3f1ef)}.nb-category-option:active{transform:scale(.98)}.nb-category-option[aria-pressed="true"]{background:color-mix(in srgb,var(--nt-primary,#596554) 13%,transparent);color:var(--nt-primary,#596554);font-weight:720}.nb-category-option:disabled{transform:none!important}.nb-mini{border:1px solid var(--nt-line,#dedbd7);border-radius:var(--nt-radius-sm,8px);background:var(--nt-surface,#fff);padding:.42rem .52rem;color:var(--nt-faint,#8c8984);font-size:.7rem;cursor:pointer;white-space:nowrap}.nb-mini:hover{background:var(--nt-surface-hover,#f3f1ef);color:var(--nt-ink,#31302e)}
      #${PLUGIN_ID} .nb-actions{display:flex;gap:.5rem;align-items:center;padding:.7rem .8rem;border-bottom:1px solid var(--nt-line,#dedbd7)}.nb-primary{border:1px solid var(--nt-primary,#596554);background:var(--nt-primary,#596554);color:var(--nt-primary-contrast,#fff);border-radius:var(--nt-radius-sm,8px);padding:.48rem .7rem;font-weight:700;font-size:.75rem;cursor:pointer}.nb-primary:hover{background:var(--nt-primary-active,#465142)}.nb-secondary{border:1px solid var(--nt-line,#dedbd7);background:var(--nt-surface,#fff);color:var(--nt-ink,#31302e);border-radius:var(--nt-radius-sm,8px);padding:.48rem .7rem;font-size:.75rem;cursor:pointer}.nb-secondary:hover{background:var(--nt-surface-hover,#f3f1ef)}#${PLUGIN_ID} button:disabled,#${PLUGIN_ID} input:disabled,#${PLUGIN_ID} select:disabled{opacity:.45;cursor:not-allowed}.nb-danger{color:#b45353;border-color:#e8c9c9}.nb-actions .nb-count{margin-left:auto;font-size:.7rem;color:var(--nt-faint,#8c8984);white-space:nowrap}
      #${PLUGIN_ID} .nb-progress{height:6px;background:var(--nt-canvas,#f6f5f4);border-radius:999px;overflow:hidden;margin:.15rem .8rem .65rem}.nb-progress i{display:block;width:0;height:100%;background:var(--nt-primary,#596554);transition:width .2s}.nb-status{padding:0 .8rem .65rem;font-size:.7rem;color:var(--nt-faint,#8c8984)}
      #${PLUGIN_ID} .nb-artist{display:grid;grid-template-columns:18px 1fr auto;gap:.5rem;align-items:center;padding:.52rem .8rem;border-bottom:1px solid color-mix(in srgb,var(--nt-line,#dedbd7) 55%,transparent);font-size:.76rem}.nb-artist:hover{background:var(--nt-surface-hover,#f3f1ef)}.nb-artist input{accent-color:var(--nt-primary,#596554)}.nb-artist strong{display:block;white-space:nowrap;text-overflow:ellipsis;overflow:hidden}.nb-artist small{display:block;color:var(--nt-faint,#8c8984);font-family:ui-monospace,SFMono-Regular,Consolas,monospace;white-space:nowrap;text-overflow:ellipsis;overflow:hidden}.nb-artist-badges{display:flex;align-items:center;justify-content:flex-end;gap:.3rem;flex-wrap:wrap}.nb-badge{font-size:.62rem;color:var(--nt-faint,#8c8984);padding:.14rem .34rem;border-radius:5px;background:var(--nt-canvas,#f6f5f4);white-space:nowrap}.nb-badge.ok{color:#367a5c;background:#e7f2eb}.nb-badge.err{color:#a64d4d;background:#f8e9e9}.nb-badge.review{color:#8b6c32;background:#f7efd9}
      #${PLUGIN_ID} .nb-review-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.65rem;padding:.8rem}.nb-review{border:1px solid var(--nt-line,#dedbd7);border-radius:var(--nt-radius-sm,8px);overflow:hidden;background:var(--nt-canvas,#f6f5f4)}.nb-review img{display:block;width:100%;aspect-ratio:1/1;object-fit:cover;background:#e8e5e1}.nb-review-body{padding:.48rem}.nb-review-name{font-size:.72rem;font-weight:700;white-space:nowrap;text-overflow:ellipsis;overflow:hidden}.nb-review-state{font-size:.65rem;color:var(--nt-faint,#8c8984)}.nb-review-buttons{display:flex;gap:.35rem;margin-top:.4rem}.nb-review-buttons button{flex:1;padding:.32rem .2rem;font-size:.66rem;border-radius:6px}.nb-review-expand{flex:0 0 auto!important;color:var(--nt-faint,#8c8984);border-color:var(--nt-line,#dedbd7)!important;background:transparent!important}.nb-review-expand:hover{color:var(--nt-ink,#31302e);background:var(--nt-surface-hover,#f3f1ef)!important}.nb-lightbox{position:fixed;inset:0;z-index:240;display:flex;align-items:center;justify-content:center;padding:2.5rem;background:rgba(12,14,16,.86);backdrop-filter:blur(8px);animation:nb-lightbox-in .18s ease-out}.nb-lightbox img{display:block;max-width:min(94vw,1100px);max-height:calc(100vh - 5rem);width:auto;height:auto;object-fit:contain;border-radius:8px;box-shadow:0 24px 70px rgba(0,0,0,.38)}.nb-lightbox-close{position:absolute;top:1rem;right:1rem;border:1px solid rgba(255,255,255,.28);border-radius:7px;padding:.4rem .65rem;background:rgba(255,255,255,.1);color:#fff;font:inherit;font-size:.72rem;cursor:pointer}.nb-lightbox-close:hover{background:rgba(255,255,255,.2)}@keyframes nb-lightbox-in{from{opacity:0}to{opacity:1}}@media(prefers-reduced-motion:reduce){#${PLUGIN_ID} .nb-lightbox{animation:none}}
      #${PLUGIN_ID} .nb-empty{padding:2rem .8rem;text-align:center;color:var(--nt-faint,#8c8984);font-size:.75rem}.nb-log-panel{border-top:1px solid var(--nt-line,#dedbd7);padding:.65rem .8rem;background:var(--nt-surface,#fff)}.nb-log-head{display:flex;align-items:center;justify-content:space-between;gap:.5rem;font-size:.7rem;font-weight:700;color:var(--nt-faint,#8c8984)}.nb-log-head>div{display:flex;gap:.3rem}.nb-log-head button{font-size:.64rem;padding:.25rem .42rem}.nb-log-list{max-height:190px;overflow:auto;margin-top:.45rem}.nb-log-entry{margin:.3rem 0;border:1px solid var(--nt-line,#dedbd7);border-radius:6px;background:var(--nt-canvas,#f6f5f4);font-size:.65rem}.nb-log-entry summary{cursor:pointer;padding:.35rem .45rem;list-style:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.nb-log-entry summary::-webkit-details-marker{display:none}.nb-log-entry summary:before{content:'›';display:inline-block;margin-right:.25rem;transition:transform .15s}.nb-log-entry[open] summary:before{transform:rotate(90deg)}.nb-log-entry.request{border-left:3px solid #7c8ea3}.nb-log-entry.success{border-left:3px solid #5a9b78}.nb-log-entry.error{border-left:3px solid #c86b6b}.nb-log-entry.info{border-left:3px solid #a28b5a}.nb-log-meta{color:var(--nt-faint,#8c8984);font-family:ui-monospace,SFMono-Regular,Consolas,monospace}.nb-log-details{margin:0;padding:.45rem .55rem;border-top:1px solid var(--nt-line,#dedbd7);white-space:pre-wrap;word-break:break-word;font: .62rem/1.4 ui-monospace,SFMono-Regular,Consolas,monospace;color:var(--nt-ink,#31302e);max-height:180px;overflow:auto}.nb-footer{display:flex;align-items:center;justify-content:flex-end;flex-wrap:wrap;gap:.55rem;padding:.75rem .9rem;border-top:1px solid var(--nt-line,#dedbd7);background:var(--nt-surface,#fff)}
      .dark #${PLUGIN_ID}{color:var(--nt-ink,#f1f1ef)}.dark #${PLUGIN_ID} .nb-window,.dark #${PLUGIN_ID} .nb-head,.dark #${PLUGIN_ID} .nb-footer,.dark #${PLUGIN_ID} .nb-secondary{background:var(--nt-surface,#1f2937)}.dark #${PLUGIN_ID} .nb-input,.dark #${PLUGIN_ID} textarea,.dark #${PLUGIN_ID} select,.dark #${PLUGIN_ID} .nb-note,.dark #${PLUGIN_ID} .nb-review,.dark #${PLUGIN_ID} .nb-review img{background:var(--nt-canvas,#191919)}.dark #${PLUGIN_ID} .nb-category-menu{background:color-mix(in srgb,var(--nt-surface,#1f2937) 96%,transparent);box-shadow:0 8px 18px rgba(0,0,0,.3),inset 0 1px 0 rgba(255,255,255,.08)}.dark #${PLUGIN_ID} .nb-category-menu.open{box-shadow:0 18px 40px rgba(0,0,0,.4),inset 0 1px 0 rgba(255,255,255,.1)}
      @media(max-width:980px){#${PLUGIN_ID} .nb-body{grid-template-columns:250px minmax(260px,1fr)}#${PLUGIN_ID} .nb-col:last-child{grid-column:1/-1;border-top:1px solid var(--nt-line,#dedbd7);max-height:260px}#${PLUGIN_ID} .nb-review-grid{grid-template-columns:repeat(4,minmax(0,1fr))}}@media(max-width:650px){#${PLUGIN_ID}{padding:0}#${PLUGIN_ID} .nb-window{width:100vw;height:100vh;border-radius:0}#${PLUGIN_ID} .nb-body{display:flex;flex-direction:column;overflow:auto}#${PLUGIN_ID} .nb-col{border-right:0;border-bottom:1px solid var(--nt-line,#dedbd7);max-height:none!important}#${PLUGIN_ID} .nb-col:nth-child(2){min-height:300px}#${PLUGIN_ID} .nb-review-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
      /* The review rail uses a fluid wrap so an odd final item fills the row. */
      #${PLUGIN_ID} .nb-review-grid{display:flex;flex-wrap:wrap;align-items:flex-start;gap:.65rem}
      #${PLUGIN_ID} .nb-review{flex:1 1 calc(50% - .325rem);min-width:0}
      @media(max-width:980px){#${PLUGIN_ID} .nb-review{flex-basis:calc(25% - .4875rem)}}
      @media(max-width:650px){#${PLUGIN_ID} .nb-review{flex-basis:calc(50% - .325rem)}}
    `;
    document.head.appendChild(style);
  }

function bind() {
    const root = document.getElementById(PLUGIN_ID);
    if (!root) return;
    root.querySelectorAll('[data-nb-category],[data-nb-category-toggle],[data-nb-search],[data-nb-select-visible],[data-nb-select-missing],[data-nb-unselect-visible],[data-nb-artist]').forEach((control) => { control.disabled = local.running; });
    const selectVisibleButton = root.querySelector('[data-nb-select-visible]');
    const selectMissingButton = root.querySelector('[data-nb-select-missing]');
    const unselectVisibleButton = root.querySelector('[data-nb-unselect-visible]');
    if (selectVisibleButton) selectVisibleButton.textContent = '全选';
    if (selectMissingButton) selectMissingButton.textContent = '选择无例图';
    if (selectMissingButton) selectMissingButton.disabled = local.running || !local.imageFlagsReady;
    if (unselectVisibleButton) unselectVisibleButton.textContent = '取消当前';
    root.querySelector('[data-nb-close]')?.addEventListener('click', close);
    root.querySelector('[data-nb-key]')?.addEventListener('input', (event) => { local.key = event.target.value; });
    root.querySelector('[data-nb-search]')?.addEventListener('input', (event) => {
      if (local.running) return;
      captureDraft(root);
      local.search = event.target.value;
      render();
      const searchInput = document.querySelector(`#${PLUGIN_ID} [data-nb-search]`);
      if (searchInput) { searchInput.focus(); searchInput.setSelectionRange(local.search.length, local.search.length); }
    });
    const categoryMenu = root.querySelector('[data-nb-category-menu]');
    const categoryToggle = root.querySelector('[data-nb-category-toggle]');
    const closeCategoryMenu = () => {
      categoryMenu?.classList.remove('open');
      categoryToggle?.setAttribute('aria-expanded', 'false');
    };
    categoryToggle?.addEventListener('click', () => {
      if (local.running) return;
      const opening = !categoryMenu.classList.contains('open');
      categoryMenu.classList.toggle('open', opening);
      categoryToggle.setAttribute('aria-expanded', String(opening));
      if (opening) categoryMenu.querySelector('.nb-category-option[aria-pressed="true"]')?.focus({ preventScroll: true });
    });
    categoryMenu?.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') { closeCategoryMenu(); categoryToggle?.focus(); }
    });
    root.querySelectorAll('[data-nb-category]').forEach((button) => {
      button.addEventListener('click', () => {
        if (local.running) return;
        if (local.category === button.dataset.nbCategory) { closeCategoryMenu(); return; }
        captureDraft(root);
        local.selected.clear();
        local.category = button.dataset.nbCategory;
        local.search = '';
        local.status = `已切换到“${local.category}”，旧选择已清空。请检查列表后再全选当前分类。`;
        render();
      });
    });
    root.addEventListener('click', (event) => { if (categoryMenu?.classList.contains('open') && !categoryMenu.contains(event.target)) closeCategoryMenu(); });
    root.querySelector('[data-nb-select-visible]')?.addEventListener('click', () => { if (local.running) return; const visible = visibleArtists(); visible.forEach((artist) => local.selected.add(String(artist.id))); local.status = `已选择当前分类中的 ${visible.length} 位画师。`; updateSelectionUi(); });
    root.querySelector('[data-nb-select-missing]')?.addEventListener('click', () => { if (local.running) return; const missing = visibleArtists().filter((artist) => !hasExampleImage(artist)); missing.forEach((artist) => local.selected.add(String(artist.id))); local.status = `已选择当前分类中的 ${missing.length} 位无例图画师。`; updateSelectionUi(); });
    root.querySelector('[data-nb-unselect-visible]')?.addEventListener('click', () => { if (local.running) return; visibleArtists().forEach((artist) => local.selected.delete(String(artist.id))); local.status = '已取消当前结果中的画师选择。'; updateSelectionUi(); });
    root.querySelectorAll('[data-nb-artist]').forEach((input) => input.addEventListener('change', (event) => { if (local.running) return; const id = event.target.dataset.nbArtist; event.target.checked ? local.selected.add(id) : local.selected.delete(id); local.status = ''; updateSelectionUi(); }));
    root.querySelector('[data-nb-generate]')?.addEventListener('click', () => { local.key = root.querySelector('[data-nb-key]').value.trim(); syncSettings(root); run(chosenArtists().map((artist) => String(artist.id))); });
    root.querySelector('[data-nb-retry]')?.addEventListener('click', () => { local.key = root.querySelector('[data-nb-key]').value.trim(); syncSettings(root); run([...local.results.values()].filter((result) => result.status === 'error').map((result) => String(result.artist.id))); });
    root.querySelector('[data-nb-stop]')?.addEventListener('click', () => local.abort?.abort());
    root.querySelector('[data-nb-pause]')?.addEventListener('click', () => { if (!local.running) return; local.paused = !local.paused; local.status = local.paused ? '已暂停，当前请求完成后不会提交下一张。' : '已继续，准备提交下一张。'; render(); });
    root.querySelector('[data-nb-copy-log]')?.addEventListener('click', copyLogs);
    root.querySelector('[data-nb-clear-log]')?.addEventListener('click', () => { local.logs = []; renderLogPanel(); });
    root.querySelectorAll('[data-nb-review-expand]').forEach((button) => button.addEventListener('click', () => {
      const result = local.results.get(button.dataset.nbId);
      if (result) openReviewPreview(result);
    }));
    root.querySelector('[data-nb-approve-all]')?.addEventListener('click', async () => { for (const result of [...local.results.values()]) if (result.status === 'done') await settleReview(result, true); });
    root.querySelector('[data-nb-reject-all]')?.addEventListener('click', async () => { for (const result of [...local.results.values()]) if (result.status === 'done') await settleReview(result, false); });
    root.querySelector('[data-nb-export]')?.addEventListener('click', exportManagerData);
    root.querySelectorAll('[data-nb-review-action]').forEach((button) => button.addEventListener('click', async () => { const result = local.results.get(button.dataset.nbId); if (!result) return; await settleReview(result, button.dataset.nbReviewAction === 'approve'); }));
  }

function captureDraft(root) {
    const keyInput = root.querySelector('[data-nb-key]');
    if (keyInput) local.key = keyInput.value.trim();
    if (root.querySelector('[data-nb-model]')) syncSettings(root);
  }

function updateSelectionUi() {
    const root = document.getElementById(PLUGIN_ID);
    if (!root) return;
    root.querySelectorAll('[data-nb-artist]').forEach((input) => { input.checked = local.selected.has(input.dataset.nbArtist); });
    const count = root.querySelector('.nb-count');
    if (count) count.textContent = `当前 ${visibleArtists().length} · 已选 ${local.selected.size} · 通过 ${[...local.results.values()].filter((result) => result.approved).length}`;
    const generate = root.querySelector('[data-nb-generate]');
    if (generate) generate.disabled = local.running || !local.selected.size;
    const status = root.querySelector('[data-nb-status]');
    if (status) status.textContent = local.status || `待生成 ${local.selected.size} 位`;
  }

function syncSettings(root) {
    local.settings.model = root.querySelector('[data-nb-model]').value;
    local.settings.positive = root.querySelector('[data-nb-positive]').value;
    local.settings.negative = root.querySelector('[data-nb-negative]').value;
    local.settings.width = root.querySelector('[data-nb-width]').value;
    local.settings.height = root.querySelector('[data-nb-height]').value;
    local.settings.steps = root.querySelector('[data-nb-steps]').value;
    local.settings.scale = root.querySelector('[data-nb-scale]').value;
    local.settings.sampler = root.querySelector('[data-nb-sampler]').value;
    local.settings.quality = root.querySelector('[data-nb-quality]').checked;
  }

function render(options = {}) {
    const root = document.getElementById(PLUGIN_ID);
    if (!root) return;
    const savedScroll = options.preserveScroll ? {
      artistList: root.querySelector('[data-nb-artist-list-scroll]')?.scrollTop || 0,
      reviewList: root.querySelector('[data-nb-review-scroll]')?.scrollTop || 0
    } : null;
    const s = local.settings;
    const visible = visibleArtists();
    const done = resultCount('done');
    const errors = resultCount('error');
    const reviewResults = [...local.results.values()].filter((result) => ['done', 'rejected'].includes(result.status));
    const categories = ['全部', '未分类', ...(manager().state?.categories || [])].filter((item, index, list) => list.indexOf(item) === index);
    root.innerHTML = `<div class="nb-window" role="dialog" aria-modal="true" aria-label="NAI 批量更新">
      <div class="nb-head"><div><div class="nb-title">NAI 批量更新</div><div class="nb-sub">把固定提示词应用到画师列表，审查后写回本地例图</div></div><button class="nb-close" data-nb-close aria-label="关闭">×</button></div>
      <div class="nb-body">
        <section class="nb-col"><div class="nb-col-title">生成设置</div><div class="nb-scroll nb-pad">
          <label class="nb-field"><span class="nb-label">NovelAI API Key（仅本次会话）</span><input class="nb-input" data-nb-key type="password" autocomplete="off" value="${esc(local.key)}" placeholder="Bearer key"></label>
          <label class="nb-field"><span class="nb-label">NovelAI 模型</span><select data-nb-model>${MODEL_OPTIONS.map(([value, label]) => `<option value="${value}" ${s.model === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
          <label class="nb-field"><span class="nb-label">固定正面提示词</span><textarea data-nb-positive>${esc(s.positive)}</textarea></label>
          <label class="nb-field"><span class="nb-label">固定负面提示词</span><textarea data-nb-negative>${esc(s.negative)}</textarea></label>
          <div class="nb-two"><label class="nb-field"><span class="nb-label">宽度</span><input class="nb-input" data-nb-width type="number" value="${s.width}"></label><label class="nb-field"><span class="nb-label">高度</span><input class="nb-input" data-nb-height type="number" value="${s.height}"></label></div>
          <div class="nb-two"><label class="nb-field"><span class="nb-label">步数</span><input class="nb-input" data-nb-steps type="number" value="${s.steps}"></label><label class="nb-field"><span class="nb-label">Scale</span><input class="nb-input" data-nb-scale type="number" step="0.1" value="${s.scale}"></label></div>
          <div class="nb-two"><label class="nb-field"><span class="nb-label">采样器</span><select data-nb-sampler><option ${s.sampler === 'k_euler_ancestral' ? 'selected' : ''}>k_euler_ancestral</option><option ${s.sampler === 'k_euler' ? 'selected' : ''}>k_euler</option><option ${s.sampler === 'k_dpmpp_2s_ancestral' ? 'selected' : ''}>k_dpmpp_2s_ancestral</option><option ${s.sampler === 'k_dpmpp_2m_sde' ? 'selected' : ''}>k_dpmpp_2m_sde</option></select></label><div class="nb-field"><span class="nb-label">请求策略</span><div class="nb-note">每次 API 请求固定 1 张，收到结果后才提交下一张</div></div></div>
          <label class="nb-check"><input data-nb-quality type="checkbox" ${s.quality ? 'checked' : ''}>开启 quality toggle</label>
          <div class="nb-note">正面提示词支持 <b>{artist}</b>，会自动替换成当前画师 tag。没有占位符时会追加 tag。</div>
        </div></section>
         <section class="nb-col"><div class="nb-col-title">画师列表 · ${allArtists().length}</div><div class="nb-toolbar"><div class="nb-category-slot"><div class="nb-category-menu" data-nb-category-menu style="--nb-category-height:${Math.min(46 + categories.length * 32, 300)}px"><button class="nb-category-toggle" type="button" data-nb-category-toggle aria-label="展开分类列表" aria-expanded="false"><span>分类</span><span class="nb-category-current">· ${esc(local.category)}</span></button><div class="nb-category-list-wrap"><div class="nb-category-list" role="listbox" aria-label="画师分类">${categories.map((category) => `<button class="nb-category-option" type="button" data-nb-category="${esc(category)}" aria-pressed="${local.category === category}">${esc(category)}</button>`).join('')}</div></div></div></div><input class="nb-input" data-nb-search value="${esc(local.search)}" placeholder="搜索名称或 tag"><button class="nb-mini" data-nb-select-missing ${local.imageFlagsReady ? '' : 'disabled'}>选择无例图</button><button class="nb-mini" data-nb-select-visible>全选</button><button class="nb-mini" data-nb-unselect-visible>取消</button></div><div class="nb-actions"><button class="nb-primary" data-nb-generate ${local.running || !local.selected.size ? 'disabled' : ''}>生成选中</button><button class="nb-secondary" data-nb-retry ${local.running || !errors ? 'disabled' : ''}>重试失败</button><button class="nb-secondary" data-nb-pause ${local.running ? '' : 'disabled'}>${local.paused ? '继续' : '暂停'}</button><button class="nb-secondary nb-danger" data-nb-stop ${local.running ? '' : 'disabled'}>停止</button><span class="nb-count">已选 ${local.selected.size} · 通过 ${[...local.results.values()].filter((result) => result.approved).length}</span></div><div class="nb-progress"><i data-nb-progress style="width:${local.progress}%"></i></div><div class="nb-status" data-nb-status>${local.running ? (local.status || '准备中…') : (local.status || `待生成 ${local.selected.size} 位 · 已生成 ${done}${errors ? ` · 失败 ${errors}` : ''}`)}</div><div class="nb-scroll" data-nb-artist-list-scroll>${visible.length ? visible.map((artist) => { const result = local.results.get(String(artist.id)); const status = result?.status === 'done' ? '<span class="nb-badge review">待审</span>' : result?.status === 'rejected' ? '<span class="nb-badge">已拒绝</span>' : result?.status === 'error' ? '<span class="nb-badge err">失败</span>' : result?.status === 'running' ? '<span class="nb-badge">生成中</span>' : ''; const example = hasExampleImage(artist) ? '<span class="nb-badge ok">有例图</span>' : ''; return `<label class="nb-artist"><input type="checkbox" data-nb-artist="${esc(String(artist.id))}" ${local.selected.has(String(artist.id)) ? 'checked' : ''}><span><strong>${esc(artist.name || artist.tag)}</strong><small>${esc(artist.tag || '')}</small></span><span class="nb-artist-badges">${example}${status}</span></label>`; }).join('') : '<div class="nb-empty">没有匹配的画师</div>'}</div></section>
        <section class="nb-col"><div class="nb-col-title">审查结果 · ${reviewResults.length}</div><div class="nb-actions"><button class="nb-secondary" data-nb-approve-all ${done ? '' : 'disabled'}>全部通过</button><button class="nb-secondary nb-danger" data-nb-reject-all ${done ? '' : 'disabled'}>全部拒绝</button></div><div class="nb-scroll" data-nb-review-scroll><div class="nb-review-grid">${reviewResults.length ? reviewResults.map((result) => `<article class="nb-review"><img src="${esc(result.dataUrl || '')}" alt=""><div class="nb-review-body"><div class="nb-review-name">${esc(result.artist.name || result.artist.tag)}</div><div class="nb-review-state">${result.approved ? '已通过' : result.status === 'rejected' ? '已拒绝' : '待审查'}</div><div class="nb-review-buttons"><button class="nb-secondary nb-review-expand" data-nb-review-expand data-nb-id="${esc(String(result.artist.id))}">全屏查看</button><button class="nb-secondary" data-nb-review-action="approve" data-nb-id="${esc(String(result.artist.id))}">通过</button><button class="nb-secondary nb-danger" data-nb-review-action="reject" data-nb-id="${esc(String(result.artist.id))}">拒绝</button></div></div></article>`).join('') : '<div class="nb-empty">生成结果会出现在这里</div>'}</div></div><div class="nb-log-panel"><div class="nb-log-head"><span data-nb-log-count>请求记录 · ${local.logs.length}</span><div><button class="nb-mini" data-nb-copy-log>复制</button><button class="nb-mini" data-nb-clear-log>清空</button></div></div><div class="nb-log-list" data-nb-log-list>${local.logs.length ? local.logs.map((entry) => `<details class="nb-log-entry ${esc(entry.level)}" ${entry.level === 'error' ? 'open' : ''}><summary><span class="nb-log-meta">${esc(entry.time)} · ${esc(entry.level.toUpperCase())}</span> ${esc(entry.message)}</summary>${entry.details ? `<pre class="nb-log-details">${esc(entry.details)}</pre>` : ''}</details>`).join('') : '<div class="nb-empty">暂无请求记录</div>'}</div></div></section>
       </div><div class="nb-footer"><span class="nb-sub">通过后立即写回例图；拒绝后保留画师选择，方便下一轮生成</span><button class="nb-secondary" data-nb-export>导出当前存档</button></div>
    </div>`;
    bind();
    updateSelectionUi();
    if (savedScroll) {
      const restoreScroll = () => {
        const artistList = root.querySelector('[data-nb-artist-list-scroll]');
        const reviewList = root.querySelector('[data-nb-review-scroll]');
        if (artistList) artistList.scrollTop = savedScroll.artistList;
        if (reviewList) reviewList.scrollTop = savedScroll.reviewList;
      };
      restoreScroll();
      requestAnimationFrame(restoreScroll);
    }
  }

export {ensureStyle,bind,captureDraft,updateSelectionUi,syncSettings,render};
