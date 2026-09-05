import {PLUGIN_ID} from './config.js';
import {esc} from './selectors.js';
import {manager,local} from './session.js';
import {render} from './view.js';
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

async function settleReview(result, approved) {
    if (!result || result.status !== 'done') return;
    const managerContext = manager();
    const id = String(result.artist.id);
    const name = result.artist.name || result.artist.tag || id;
    if (approved) {
      result.status = 'saving';
      local.status = `正在整理 ${name} 的图片并写入本地存档...`;
      render({ preserveScroll: true });
      try {
        let imageData = result.dataUrl;
        try {
          imageData = await convertGeneratedImageToJpeg(result.dataUrl);
        } catch (error) {
          console.warn('Generated image JPEG conversion failed; preserving original image.', error);
        }
        const storedImage = await managerContext.db?.put(result.artist.id, imageData, { stripMetadata: true });
        if (managerContext.state?.pageImages) managerContext.state.pageImages[id] = storedImage || imageData;
      } catch (error) {
        result.status = 'done';
        local.status = `保存 ${name} 失败：${error?.message || error}`;
        if (typeof showToast === 'function') showToast(`图片保存失败：${error?.message || error}`);
        render({ preserveScroll: true });
        return;
      }
      managerContext.actions?.saveMeta();
      if (typeof renderAll === 'function') renderAll();
      local.selected.delete(id);
      local.status = `已通过 ${name}，例图已立即写回画师资料；已取消选择。`;
      if (typeof showToast === 'function') showToast(`已更新 ${name} 的例图`);
    } else {
      local.status = `已拒绝 ${name}，保留选择，下一轮仍可生成。`;
    }
    local.results.delete(id);
    closeReviewPreview();
    render({ preserveScroll: true });
  }

function exportManagerData() {
    const managerActions = manager().actions;
    if (typeof managerActions?.exportData === 'function') managerActions.exportData();
    else window.alert('当前管理器没有可用的导出功能。');
  }

export {closeReviewPreview,openReviewPreview,settleReview,exportManagerData};
