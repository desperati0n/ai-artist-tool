import {local} from './session.js';
import {esc} from './selectors.js';

const reviewable = result => ['done', 'saving', 'rejected'].includes(result.status);

function reviewCardMarkup(result) {
  const id = esc(String(result.artist.id));
  return `<article class="nb-review" data-nb-review-id="${id}"><img src="${esc(result.dataUrl || '')}" alt=""><div class="nb-review-body"><div class="nb-review-name">${esc(result.artist.name || result.artist.tag)}</div><div class="nb-review-state"></div><div class="nb-review-buttons"><button class="nb-secondary nb-review-expand" data-nb-review-expand data-nb-id="${id}">全屏查看</button><button class="nb-secondary" data-nb-review-action="approve" data-nb-id="${id}">通过</button><button class="nb-secondary nb-danger" data-nb-review-action="reject" data-nb-id="${id}">拒绝</button></div></div></article>`;
}

// Keep existing images and scroll containers mounted while results arrive or save.
function syncReviewUi(root) {
  const grid = root.querySelector('.nb-review-grid');
  if (!grid) return;
  const results = [...local.results.values()].filter(reviewable);
  const ids = new Set(results.map(result => String(result.artist.id)));
  const cards = new Map();
  for (const card of grid.querySelectorAll('[data-nb-review-id]')) {
    if (!ids.has(card.dataset.nbReviewId)) card.remove();
    else cards.set(card.dataset.nbReviewId, card);
  }
  if (results.length) grid.querySelector('.nb-empty')?.remove();
  for (const result of results) {
    const id = String(result.artist.id);
    let card = cards.get(id);
    if (!card) {
      grid.insertAdjacentHTML('beforeend', reviewCardMarkup(result));
      card = grid.lastElementChild;
    }
    const img = card.querySelector('img');
    if (img.getAttribute('src') !== result.dataUrl) img.setAttribute('src', result.dataUrl || '');
    card.querySelector('.nb-review-state').textContent = result.status === 'saving' ? '正在保存…' : result.status === 'rejected' ? '已拒绝' : '待审查';
    card.querySelectorAll('[data-nb-review-action]').forEach(button => { button.disabled = result.status !== 'done'; });
  }
  if (!results.length && !grid.querySelector('.nb-empty')) {
    grid.innerHTML = '<div class="nb-empty">生成结果会出现在这里</div>';
  }
  const title = root.querySelector('[data-nb-review-count]');
  if (title) title.textContent = `审查结果 · ${results.length}`;
  root.querySelectorAll('[data-nb-approve-all], [data-nb-reject-all]').forEach(button => {
    button.disabled = local.reviewingBatch || !results.some(result => result.status === 'done');
  });
}

export {syncReviewUi};
