import {local} from './session.js';
import {render} from './view.js';
import {allArtists} from './selectors.js';
import {generateOne} from '../../services/novelai.js';
import {addLog} from './logs.js';
import {RESULT_RENDER_BATCH_SIZE,PLUGIN_ID} from './config.js';

async function run(ids) {
    if (local.running || !ids.length) return;
    local.running = true;
    local.paused = false;
    local.abort = new AbortController();
    let completed = 0;
    render({ preserveScroll: true });
    for (const id of ids) {
      if (local.abort.signal.aborted) break;
      const artist = allArtists().find((item) => String(item.id) === String(id));
      if (!artist) continue;
      const result = { artist, status: 'running', approved: false };
      local.results.set(String(id), result);
      setStatus(`正在生成 ${completed + 1}/${ids.length}：${artist.name || artist.tag}`, completed, ids.length);
      try { result.dataUrl = await generateOne(artist); result.status = 'done'; }
      catch (error) { result.status = 'error'; result.error = error.message || String(error); addLog('error', `生成失败：${artist.name || artist.tag}`, { artistId: String(artist.id), message: result.error }); }
      completed += 1;
      if (completed % RESULT_RENDER_BATCH_SIZE === 0) render({ preserveScroll: true });
      await new Promise((resolve) => setTimeout(resolve, 350));
      while (local.paused && !local.abort.signal.aborted) {
        setStatus('已暂停，当前结果已返回；点击“继续”提交下一张。', completed, ids.length);
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    }
    local.running = false;
    local.paused = false;
    setStatus(local.abort.signal.aborted ? '已停止，可重试失败项。' : `队列完成：${completed}/${ids.length}`, completed, ids.length);
    render();
  }

function setStatus(text, completed, total) {
    local.status = text;
    local.progress = total ? Math.round((completed / total) * 100) : 0;
    const status = document.querySelector(`#${PLUGIN_ID} [data-nb-status]`);
    const progress = document.querySelector(`#${PLUGIN_ID} [data-nb-progress]`);
    if (status) status.textContent = text;
    if (progress) progress.style.width = `${local.progress}%`;
  }

export {run,setStatus};
