import JSZip from 'jszip';
import {artistTag} from '../features/generation/selectors.js';
import {local} from '../features/generation/session.js';
import {addLog} from '../features/generation/logs.js';

const loadJsZip = () => Promise.resolve();

function promptFor(artist) {
    const tag = artistTag(artist);
    const fixed = local.settings.positive.trim();
    return fixed.includes('{artist}') ? fixed.replaceAll('{artist}', tag) : [fixed, tag].filter(Boolean).join(', ');
  }

function makeCorrelationId() {
    const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let value = '';
    for (let index = 0; index < 6; index += 1) value += alphabet[Math.floor(Math.random() * alphabet.length)];
    return value;
  }

async function generateOne(artist) {
    if (!local.key) throw new Error('请填写 NovelAI API Key');
    await loadJsZip();
    const s = local.settings;
    const payload = {
      input: promptFor(artist),
      model: s.model,
      action: 'generate',
      parameters: {
        width: Number(s.width), height: Number(s.height), scale: Number(s.scale), sampler: s.sampler,
        steps: Number(s.steps), n_samples: 1, ucPreset: 0, qualityToggle: !!s.quality,
        negative_prompt: s.negative.trim(), params_version: 3, seed: Math.floor(Math.random() * 2147483647)
      }
    };
    if (/^nai-diffusion-[45]/.test(s.model)) Object.assign(payload.parameters, {
      legacy: false, legacy_v3_extend: false, cfg_rescale: 0, noise_schedule: 'native',
      sm: false, sm_dyn: false, prefer_brownian: true, deliberate_euler_ancestral_bug: false,
      skip_cfg_above_sigma: null, use_coords: false,
      v4_prompt: { caption: { base_caption: payload.input, char_captions: [] }, use_coords: false, use_order: true },
      v4_negative_prompt: { caption: { base_caption: s.negative.trim(), char_captions: [] }, legacy_uc: false }
    });
    const label = artist.name || artist.tag || String(artist.id);
    const startedAt = performance.now();
    const correlationId = makeCorrelationId();
    addLog('request', `开始请求：${label}`, { artistId: String(artist.id), model: s.model, endpoint: 'https://image.novelai.net/ai/generate-image', correlationId, input: payload.input, negative_prompt: s.negative.trim(), parameters: payload.parameters });
    let response;
    try {
      response = await fetch('https://image.novelai.net/ai/generate-image', {
        method: 'POST', headers: { Authorization: `Bearer ${local.key}`, 'Content-Type': 'application/json', Accept: 'application/zip', 'x-correlation-id': correlationId },
        body: JSON.stringify(payload), signal: local.abort.signal
      });
    } catch (error) {
      addLog('error', `网络请求失败：${label}`, { artistId: String(artist.id), elapsedMs: Math.round(performance.now() - startedAt), message: error.message || String(error) });
      throw error;
    }
    if (!response.ok) {
      let body = '';
      try { body = await response.text(); } catch (_) {}
      addLog('error', `HTTP ${response.status}：${label}`, { artistId: String(artist.id), status: response.status, correlationId, contentType: response.headers.get('content-type') || '', elapsedMs: Math.round(performance.now() - startedAt), body: body.slice(0, 4000) });
      const detail = `HTTP ${response.status}${body ? ` ${body.slice(0, 180)}` : ''}`;
      const error = new Error(detail);
      error.status = response.status;
      const retryAfter = response.headers.get('retry-after');
      error.retryAfterMs = retryAfter ? Math.max(0, Number.isFinite(Number(retryAfter)) ? Number(retryAfter) * 1000 : Date.parse(retryAfter) - Date.now()) : 0;
      throw error;
    }
    const type = response.headers.get('content-type') || '';
    if (type.includes('json')) {
      const body = await response.text();
      let parsed = null;
      try { parsed = JSON.parse(body); } catch (_) {}
      addLog('error', `API 返回错误：${label}`, { artistId: String(artist.id), status: response.status, correlationId, contentType: type, elapsedMs: Math.round(performance.now() - startedAt), body: body.slice(0, 4000) });
      throw new Error(parsed?.message || parsed?.error || body.slice(0, 180) || 'NovelAI 返回错误');
    }
    const responseBlob = await response.blob();
    addLog('success', `收到响应：${label}`, { artistId: String(artist.id), status: response.status, correlationId, contentType: type, elapsedMs: Math.round(performance.now() - startedAt), bytes: responseBlob.size });
    const unpackStartedAt = performance.now();
    const zip = await JSZip.loadAsync(responseBlob);
    const entry = Object.values(zip.files).find((file) => !file.dir && /\.(png|jpe?g|webp)$/i.test(file.name));
    if (!entry) throw new Error('响应 ZIP 中没有图片');
    const blob = await entry.async('blob');
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    addLog('success', `图片解包完成：${label}`, { artistId: String(artist.id), file: entry.name, unpackMs: Math.round(performance.now() - unpackStartedAt), totalMs: Math.round(performance.now() - startedAt) });
    return dataUrl;
  }

export {loadJsZip,promptFor,makeCorrelationId,generateOne};
