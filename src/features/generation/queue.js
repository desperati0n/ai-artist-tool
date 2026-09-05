import {local} from './session.js';
import {refreshGenerationUi} from './view.js';
import {allArtists} from './selectors.js';
import {generateOne} from '../../services/novelai.js';
import {addLog} from './logs.js';
import {PLUGIN_ID} from './config.js';

function waitOrAbort(ms, signal) {
  if (signal.aborted || ms <= 0) return Promise.resolve();
  return new Promise(resolve => {
    const finish = () => { clearTimeout(timer); signal.removeEventListener('abort', finish); resolve(); };
    const timer = setTimeout(finish, ms);
    signal.addEventListener('abort', finish, {once: true});
  });
}

async function run(ids) {
  if (local.running || local.reviewingBatch || [...local.results.values()].some(result => result.status === 'saving') || !ids.length) return;
  const artists = new Map(allArtists().map(artist => [String(artist.id), artist]));
  const queue = [...new Set(ids.map(String))].map(id => artists.get(id)).filter(Boolean);
  if (!queue.length) return;
  local.running = true;
  local.paused = false;
  const abort = new AbortController();
  local.abort = abort;
  let completed = 0;
  let failures = 0;
  let stoppedForAuth = false;
  const startedAt = performance.now();
  refreshGenerationUi();
  try {
    for (const artist of queue) {
      while (local.paused && !abort.signal.aborted) {
        setStatus('已暂停，当前结果已返回；点击“继续”提交下一张。', completed, queue.length);
        await waitOrAbort(250, abort.signal);
      }
      if (abort.signal.aborted) break;
      const result = {artist, status: 'running', approved: false};
      local.results.set(String(artist.id), result);
      setStatus(`正在生成 ${completed + 1}/${queue.length}：${artist.name || artist.tag}`, completed, queue.length);
      refreshGenerationUi();
      let delayMs = 0;
      try {
        result.dataUrl = await generateOne(artist);
        result.status = 'done';
        failures = 0;
      } catch (error) {
        result.status = 'error';
        result.error = error.message || String(error);
        failures += 1;
        stoppedForAuth = [401, 403].includes(error.status);
        delayMs = Math.max(Number(error.retryAfterMs) || 0, Math.min(1000 * 2 ** (failures - 1), 10000));
        addLog('error', `生成失败：${artist.name || artist.tag}`, {artistId: String(artist.id), message: result.error});
      }
      completed += 1;
      setStatus(`已处理 ${completed}/${queue.length}`, completed, queue.length);
      refreshGenerationUi();
      if (stoppedForAuth) break;
      // Successful requests continue immediately; only failures need a cooldown.
      if (delayMs && completed < queue.length && !abort.signal.aborted) {
        addLog('info', '请求失败，等待后继续队列', {delayMs});
        await waitOrAbort(delayMs, abort.signal);
      }
    }
  } finally {
    local.running = false;
    local.paused = false;
    setStatus(stoppedForAuth ? '认证或权限错误，已停止队列；请检查 API Key 后重试。' : abort.signal.aborted ? '已停止，可重试失败项。' : `队列完成：${completed}/${queue.length}`, completed, queue.length);
    addLog('info', '队列耗时', {completed, total: queue.length, elapsedMs: Math.round(performance.now() - startedAt)});
    refreshGenerationUi();
  }
}

function setStatus(text, completed, total) {
  local.status = text;
  local.progress = total ? Math.round((completed / total) * 100) : 0;
  const status = document.querySelector(`#${PLUGIN_ID} [data-nb-status]`);
  const progress = document.querySelector(`#${PLUGIN_ID} [data-nb-progress]`);
  if (status) status.textContent = text;
  if (progress) progress.style.width = `${local.progress}%`;
}

export {run, setStatus};
