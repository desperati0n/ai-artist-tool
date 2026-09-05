import {local} from './session.js';
import {PLUGIN_ID} from './config.js';
import {esc} from './selectors.js';
import {updateSelectionUi} from './view.js';

function formatLogDetails(details) {
    if (details == null || details === '') return '';
    if (typeof details === 'string') return details;
    try { return JSON.stringify(details, null, 2); } catch (_) { return String(details); }
  }

function addLog(level, message, details) {
    local.logs.push({ time: new Date().toLocaleTimeString(), level, message, details: formatLogDetails(details) });
    if (local.logs.length > 200) local.logs.shift();
    renderLogPanel();
  }

function renderLogPanel() {
    const root = document.getElementById(PLUGIN_ID);
    if (!root) return;
    const count = root.querySelector('[data-nb-log-count]');
    if (count) count.textContent = `请求记录 · ${local.logs.length}`;
    const list = root.querySelector('[data-nb-log-list]');
    if (!list) return;
    list.innerHTML = local.logs.length ? local.logs.map((entry) => `<details class="nb-log-entry ${esc(entry.level)}" ${entry.level === 'error' ? 'open' : ''}><summary><span class="nb-log-meta">${esc(entry.time)} · ${esc(entry.level.toUpperCase())}</span> ${esc(entry.message)}</summary>${entry.details ? `<pre class="nb-log-details">${esc(entry.details)}</pre>` : ''}</details>`).join('') : '<div class="nb-empty">暂无请求记录</div>';
    list.scrollTop = list.scrollHeight;
  }

async function copyLogs() {
    const text = local.logs.map((entry) => `[${entry.time}] [${entry.level.toUpperCase()}] ${entry.message}${entry.details ? `\n${entry.details}` : ''}`).join('\n\n') || '暂无请求记录';
    try {
      await navigator.clipboard.writeText(text);
    } catch (_) {
      const textarea = document.createElement('textarea'); textarea.value = text; textarea.style.position = 'fixed'; textarea.style.opacity = '0'; document.body.appendChild(textarea); textarea.select(); document.execCommand('copy'); textarea.remove();
    }
    local.status = '请求记录已复制';
    updateSelectionUi();
  }

export {formatLogDetails,addLog,renderLogPanel,copyLogs};
