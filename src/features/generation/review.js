import {PLUGIN_ID} from './config.js';
import {esc} from './selectors.js';
import {manager,local} from './session.js';
import {refreshGenerationUi} from './view.js';
import {addLog} from './logs.js';
import {convertGeneratedImageToJpeg} from './images.js';
import {showToast} from '../../shared/notifications.js';
import {renderAll} from '../../app/render.ts';

function closeReviewPreview() {
    const preview = document.getElementById(`${PLUGIN_ID}-lightbox`);
    if (!preview) return;
    preview._onKeydown && document.removeEventListener('keydown', preview._onKeydown);
    preview.remove();
  }

function openReviewPreview(result) {
    if (!result?.dataUrl) return;
    closeReviewPreview();
    const preview = document.createElement('div');
    preview.id = `${PLUGIN_ID}-lightbox`;
    preview.className = 'nb-lightbox';
    preview.setAttribute('role', 'dialog');
    preview.setAttribute('aria-modal', 'true');
    preview.setAttribute('aria-label', `${result.artist.name || result.artist.tag || '例图'}全屏预览`);
    preview.tabIndex = -1;
    preview.innerHTML = `<button type="button" class="nb-lightbox-close" data-nb-lightbox-close>关闭</button><img src="${esc(result.dataUrl)}" alt="${esc(result.artist.name || result.artist.tag || '例图')}">`;
    preview.addEventListener('click', (event) => {
      if (event.target === preview || event.target.closest('[data-nb-lightbox-close]')) closeReviewPreview();
    });
    preview._onKeydown = (event) => { if (event.key === 'Escape') closeReviewPreview(); };
    document.addEventListener('keydown', preview._onKeydown);
    document.body.appendChild(preview);
    preview.focus({ preventScroll: true });
  }

async function settleReview(result, approved, options = {}) {
    if (!result || result.status !== 'done' || local.results.get(String(result.artist.id)) !== result) return false;
    const managerContext = manager();
    const id = String(result.artist.id);
    const name = result.artist.name || result.artist.tag || id;
    const startedAt = performance.now();
    if (approved) {
      result.status = 'saving';
      local.status = `正在整理 ${name} 的图片并写入本地存档...`;
      refreshGenerationUi();
      try {
        if (!result.preparedImage) {
          try {
            result.preparedImage = await convertGeneratedImageToJpeg(result.dataUrl);
          } catch (error) {
            console.warn('Generated image JPEG conversion failed; preserving original image.', error);
            result.preparedImage = result.dataUrl;
          }
        }
        const conversionMs = Math.round(performance.now() - startedAt);
        const saveStartedAt = performance.now();
        const storedImage = await managerContext.db.put(result.artist.id, result.preparedImage, { stripMetadata: true });
        if (managerContext.state?.pageImages) managerContext.state.pageImages[id] = storedImage || result.preparedImage;
        addLog('success', `例图保存完成：${name}`, {artistId: id, conversionMs, saveMs: Math.round(performance.now() - saveStartedAt)});
      } catch (error) {
        result.status = 'done';
        local.status = `保存 ${name} 失败：${error?.message || error}`;
        if (typeof showToast === 'function') showToast(`图片保存失败：${error?.message || error}`);
        refreshGenerationUi();
        return false;
      }
      if (!options.deferManagerRefresh) {
        managerContext.actions?.saveMeta();
        renderAll();
      }
      local.imageIds.add(id);
      local.approvedCount += 1;
      local.selected.delete(id);
      local.status = `已通过 ${name}，例图已立即写回画师资料；已取消选择。`;
      if (!options.deferManagerRefresh) showToast(`已更新 ${name} 的例图`);
    } else {
      local.status = `已拒绝 ${name}，保留选择，下一轮仍可生成。`;
    }
    local.results.delete(id);
    closeReviewPreview();
    refreshGenerationUi();
    return true;
  }

async function settleAllReviews(approved) {
    if (local.reviewingBatch) return;
    const results = [...local.results.values()].filter(result => result.status === 'done');
    if (!results.length) return;
    local.reviewingBatch = true;
    let settled = 0;
    refreshGenerationUi();
    try {
      for (const result of results) {
        if (await settleReview(result, approved, {deferManagerRefresh: true})) settled += 1;
      }
    } finally {
      local.reviewingBatch = false;
      if (approved && settled) {
        manager().actions.saveMeta();
        renderAll();
      }
      local.status = `本轮${approved ? '通过' : '拒绝'} ${settled}/${results.length} 张${settled < results.length ? '；未处理的例图仍保留在审查区' : ''}。`;
      showToast(local.status);
      refreshGenerationUi();
    }
  }

function exportManagerData() {
    const managerActions = manager().actions;
    if (typeof managerActions?.exportData === 'function') managerActions.exportData();
    else window.alert('当前管理器没有可用的导出功能。');
  }

export {closeReviewPreview,openReviewPreview,settleReview,settleAllReviews,exportManagerData};
