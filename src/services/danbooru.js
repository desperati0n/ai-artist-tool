import { state } from '../app/store.ts';
import { actions } from '../app/actions.js';

const danbooruFetcher = (() => {
            const API = 'https://danbooru.donmai.us';
            const MAX_RETRIES = 2;
            const RETRY_DELAY = 3000;
            let _cancelled = false, _running = false, _abort = null;

            class RateLimiter {
                constructor(r) { this.rate = r; this.tokens = r; this.last = performance.now(); }
                async acquire() {
                    while (true) {
                        const now = performance.now();
                        this.tokens = Math.min(this.rate, this.tokens + (now - this.last) / 1000 * this.rate);
                        this.last = now;
                        if (this.tokens >= 1) { this.tokens--; return; }
                        await new Promise(r => setTimeout(r, 60));
                    }
                }
            }
            let limiter = new RateLimiter(3);

            const normalize = (tag) => tag.trim().replace(/^,?\s*a?rt?ist:\s*/i, '').replace(/ /g, '_').toLowerCase().replace(/_+/g, '_').replace(/^_|_$/g, '');

            const _fetch = async (url, signal) => {
                await limiter.acquire();
                const r = await fetch(url, { headers: { Accept: 'application/json' }, signal });
                if (!r.ok) { const e = new Error('HTTP ' + r.status); e.status = r.status; throw e; }
                return r.json();
            };

            const _req = async (url, signal) => {
                for (let i = 0; i < MAX_RETRIES; i++) {
                    try { return [await _fetch(url, signal), null]; }
                    catch (e) {
                        if (e.name === 'AbortError') return [null, 'cancelled'];
                        if (e.status === 429) { await new Promise(r => setTimeout(r, RETRY_DELAY * (i + 2))); continue; }
                        if (i < MAX_RETRIES - 1) await new Promise(r => setTimeout(r, RETRY_DELAY));
                        else return [null, e.message || 'error'];
                    }
                }
                return [null, 'max_retries'];
            };

            const getCount = async (tag, signal) => {
                const n = normalize(tag);
                if (!n) return [0, null, 'empty'];
                let [d, e] = await _req(API + '/tags.json?search[name]=' + encodeURIComponent(n) + '&search[category]=1&limit=1', signal);
                if (e) return [0, null, 'error:' + e];
                if (d && d.length > 0) return [d[0].post_count, d[0].name, 'artist'];
                [d, e] = await _req(API + '/tags.json?search[name]=' + encodeURIComponent(n) + '&limit=1', signal);
                if (e) return [0, null, 'error:' + e];
                if (d && d.length > 0) return [d[0].post_count, d[0].name, 'any'];
                return [0, null, 'not_found'];
            };

            const getUrls = async (tag, signal) => {
                const n = normalize(tag);
                if (!n) return [[], null];
                let [ad, e1] = await _req(API + '/artists.json?search[name]=' + encodeURIComponent(n) + '&limit=1', signal);
                if (e1) return [null, e1];
                if (!ad || !ad.length || !ad[0] || !ad[0].id) return [[], null];
                let [ud, e2] = await _req(API + '/artist_urls.json?search[artist_id]=' + ad[0].id, signal);
                if (e2) return [null, e2];
                if (!ud) return [[], null];
                const seen = new Set(), out = [];
                for (const it of ud) {
                    const u = typeof it === 'string' ? it : (it && it.is_active !== false ? it.url : null);
                    if (u) { const k = u.trim().replace(/\/+$/, ''); if (!seen.has(k)) { seen.add(k); out.push(u.trim()); } }
                }
                return [out, null];
            };

            const pool = async (limit, items, fn) => {
                const exec = new Set();
                for (let i = 0; i < items.length; i++) {
                    if (_cancelled) break;
                    const p = fn(items[i], i).finally(() => exec.delete(p));
                    exec.add(p);
                    if (exec.size >= limit) await Promise.race(exec);
                }
                if (exec.size > 0) await Promise.allSettled([...exec]);
            };

            const start = async (opts) => {
                if (_running) return;
                _running = true; _cancelled = false;
                _abort = new AbortController();
                const o = opts || {};
                const force = !!o.force, skipUrls = !!o.skipUrls, urlsOnly = !!o.urlsOnly;
                const rate = o.rateLimit || 3, conc = o.concurrency || 3;
                const onProg = o.onProgress || function(){}, onLog = o.onLog || function(){}, onDone = o.onComplete || function(){};
                limiter = new RateLimiter(rate);
                const sig = _abort.signal, arts = state.artists, todo = [];

                if (force) {
                    for (let i = 0; i < arts.length; i++) todo.push({ i: i, a: arts[i], m: 'full' });
                    onLog('\u5f3a\u5236\u6a21\u5f0f\uff1a\u5168\u90e8 ' + arts.length + ' \u4f4d\u753b\u5e08');
                } else if (urlsOnly) {
                    for (let i = 0; i < arts.length; i++) if ((arts[i].danbooruCount||0)>0 && (!arts[i].socialLinks||!arts[i].socialLinks.length)) todo.push({ i: i, a: arts[i], m: 'urls' });
                    onLog('\u8865\u6293\u94fe\u63a5\uff1a' + todo.length + ' \u4f4d');
                } else {
                    for (let i = 0; i < arts.length; i++) {
                        if (!(arts[i].danbooruCount > 0)) todo.push({ i: i, a: arts[i], m: 'full' });
                        else if (!skipUrls && (!arts[i].socialLinks||!arts[i].socialLinks.length)) todo.push({ i: i, a: arts[i], m: 'urls' });
                    }
                    onLog('\u9700\u66f4\u65b0: ' + todo.length + ' / ' + arts.length);
                }
                if (!todo.length) { onLog('\u2705 \u6240\u6709\u6570\u636e\u5df2\u662f\u6700\u65b0'); onDone({ done:0, found:0, notFound:0, error:0, total:0 }); _running = false; return; }
                const s = { done:0, found:0, notFound:0, error:0, total:todo.length, t0:performance.now() };
                onLog('\u5f00\u59cb (\u5e76\u53d1=' + conc + ', \u901f\u7387=' + rate + '/s)');
                let saveN = 0;
                await pool(conc, todo, async (item) => {
                    if (_cancelled) return;
                    const tag = item.a.tag || '';
                    if (!tag.trim()) { s.done++; onProg(s, ''); return; }
                    try {
                        if (item.m === 'urls') {
                            const [urls, err] = await getUrls(tag, sig);
                            if (!err && urls) { state.artists[item.i].socialLinks = urls; urls.length ? s.found++ : s.notFound++; } else s.error++;
                        } else {
                            const [cnt,,mth] = await getCount(tag, sig);
                            if (cnt > 0) {
                                state.artists[item.i].danbooruCount = cnt; s.found++;
                                if (!skipUrls) { const [urls, err] = await getUrls(tag, sig); if (!err && urls) state.artists[item.i].socialLinks = urls; }
                            } else if (mth && mth.indexOf('error') >= 0) s.error++;
                            else s.notFound++;
                        }
                    } catch(e) { if (e.name !== 'AbortError') s.error++; }
                    s.done++; saveN++;
                    onProg(s, tag);
                    if (saveN % 20 === 0) { actions.saveMeta(); onLog('\ud83d\udcbe \u5df2\u4fdd\u5b58 (' + s.done + '/' + s.total + ')'); }
                });
                actions.saveMeta(); _running = false;
                if (_cancelled) onLog('\u26a0\ufe0f \u5df2\u53d6\u6d88 (' + s.done + '/' + s.total + ')\uff0c\u6570\u636e\u5df2\u4fdd\u5b58');
                else onLog('\u2705 \u5b8c\u6210! \u5339\u914d:' + s.found + ' \u672a\u627e\u5230:' + s.notFound + ' \u9519\u8bef:' + s.error);
                onDone(s);
            };

            return {
                normalize, getCount, getUrls, start,
                cancel: function() { _cancelled = true; if (_abort) _abort.abort(); },
                isRunning: function() { return _running; }
            };
        })();

export { danbooruFetcher };
