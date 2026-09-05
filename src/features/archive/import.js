import { localArchive } from '../../storage/localArchive.js';
import { showToast, formatArchiveSize, showArchiveProgress, hideArchiveProgress } from '../../shared/notifications.js';
import { state } from '../../app/store.ts';
import { findEquivalentArtist } from '../../shared/artistIdentity.js';
import { db } from '../../storage/images.js';
import { actions } from '../../app/actions.js';
import { applyArtistDeduplication } from '../artists/identity.js';
import { renderAll } from '../../app/render.ts';

const importData = async (file) => {
                if(!file) return;
                if (/\.zip$/i.test(file.name || '')) {
                    if (!localArchive.available) return showToast('ZIP 存档需要通过 run_server.py 打开工具后恢复');
                    const archiveSize = formatArchiveSize(file.size);
                    if (!confirm(`将从「${file.name}」（${archiveSize}）恢复完整存档。\n\n恢复成功后会替换当前 data/ 存档；任何校验失败都会保留当前数据。确定继续吗？`)) return;
                    showArchiveProgress('导入存档', `准备上传 ${file.name}`, 0);
                    try {
                        await localArchive.flush();
                        localArchive.suspendWrites = true;
                        const result = await localArchive.importZip(file, ({ phase, percent }) => {
                            if (phase === 'upload') {
                                showArchiveProgress('导入存档', `正在上传 ${archiveSize}`, percent);
                            } else {
                                showArchiveProgress('导入存档', '上传完成，正在校验图片、生成缩略图并安全切换存档…', null);
                            }
                        });
                        showArchiveProgress('导入完成', `${result.artists || 0} 位画师 · ${result.images || 0} 张原图，正在刷新页面…`, 100);
                        setTimeout(() => location.reload(), 900);
                    } catch (error) {
                        localArchive.suspendWrites = false;
                        console.error('ZIP import failed:', error);
                        hideArchiveProgress();
                        showToast(`存档恢复失败：${error.message || error}`);
                    }
                    return;
                }
                const importLargeBackup = async (largeFile) => {
                    if (!largeFile.stream || typeof TextDecoder === 'undefined') throw new Error('当前浏览器不支持大文件流式导入');
                    const existingPresetNames = new Set(state.presets.map(p => String(p.name || '')));
                    const usedIds = new Set([...state.artists, ...state.presets].map(item => String(item.id)));
                    const importedArtistIds = new Map();
                    const allocateImportedId = (sourceId) => {
                        const candidate = String(sourceId || '');
                        if (/^[A-Za-z0-9._-]{1,160}$/.test(candidate) && !usedIds.has(candidate)) {
                            usedIds.add(candidate);
                            return candidate;
                        }
                        let generated;
                        do { generated = String(Date.now() + Math.random()); } while (usedIds.has(generated));
                        usedIds.add(generated);
                        return generated;
                    };
                    let addedCount = 0;
                    let updatedCount = 0;
                    let importedImages = 0;
                    const importArtist = async (item) => {
                        if (!item || typeof item !== 'object') return;
                        let tag = String(item.tag || item.prompt || '');
                        let name = String(item.name || '');
                        if (!tag && name) tag = name;
                        if (!name && tag) name = tag;
                        if (!tag) return;
                        let cats = Array.isArray(item.categories) ? item.categories.filter(c => typeof c === 'string') : [];
                        if (item.category && item.category !== '未分类') cats.push(String(item.category));
                        cats = [...new Set(cats.length ? cats : ['未分类'])];
                        cats.forEach(c => { if (c !== '未分类' && !state.categories.includes(c)) state.categories.push(c); });
                        const img = typeof item.imageUrl === 'string' ? item.imageUrl : (typeof item.image === 'string' ? item.image : '');
                        const existing = findEquivalentArtist(state.artists, { tag, name });
                        if (existing) {
                            if (item.id !== undefined && item.id !== null) importedArtistIds.set(String(item.id), String(existing.id));
                            if (img.startsWith('data:')) { state.pageImages[existing.id] = await db.put(existing.id, img); importedImages++; }
                            if (item.danbooruCount !== undefined) existing.danbooruCount = parseInt(item.danbooruCount) || 0;
                            if (Array.isArray(item.socialLinks)) existing.socialLinks = item.socialLinks;
                            existing.categories = [...new Set([...(existing.categories || []), ...cats])];
                            updatedCount++;
                        } else {
                            const id = allocateImportedId(item.id);
                            if (item.id !== undefined && item.id !== null) importedArtistIds.set(String(item.id), id);
                            if (img.startsWith('data:')) { state.pageImages[id] = await db.put(id, img); importedImages++; }
                            state.artists.push({ id, name: name || 'Unknown', tag, categories: cats, danbooruCount: parseInt(item.danbooruCount) || 0, socialLinks: Array.isArray(item.socialLinks) ? item.socialLinks : [], createdAt: item.createdAt || Date.now() });
                            addedCount++;
                        }
                    };
                    const importPreset = async (item) => {
                        if (!item || typeof item !== 'object') return;
                        const name = String(item.name || '');
                        if (existingPresetNames.has(name)) return;
                        const id = allocateImportedId(item.id);
                        const imageValue = typeof item.imageUrl === 'string' ? item.imageUrl : (typeof item.image === 'string' ? item.image : '');
                        if (imageValue.startsWith('data:')) { state.pageImages[id] = await db.put(id, imageValue); importedImages++; }
                        const { imageUrl, image: _image, ...meta } = item;
                        const remappedItems = Array.isArray(item.items) ? item.items.map(presetItem => ({
                            ...presetItem,
                            id: importedArtistIds.get(String(presetItem.id)) || String(presetItem.id)
                        })) : [];
                        state.presets.push({ ...meta, id, name, items: remappedItems });
                        existingPresetNames.add(name);
                    };
                    const markerFor = key => `"${key}":[`;
                    const reader = largeFile.stream().getReader();
                    const decoder = new TextDecoder();
                    let headerApplied = false;
                    let phase = 'find-artists';
                    let search = '';
                    let parser = null;
                    const createParser = (callback) => {
                        let depth = 0, objectStart = -1, inString = false, escaped = false;
                        return async (text) => {
                            for (let i = 0; i < text.length; i++) {
                                const ch = text[i];
                                if (inString) {
                                    if (escaped) escaped = false; else if (ch === '\\') escaped = true; else if (ch === '"') inString = false;
                                    if (depth > 0) search += ch;
                                    continue;
                                }
                                if (ch === '"') { inString = true; if (depth > 0) search += ch; continue; }
                                if (depth === 0 && ch === ']') return { done: true, rest: text.slice(i + 1) };
                                if (ch === '{') { if (depth === 0) { search = ''; objectStart = i; } depth++; search += ch; continue; }
                                if (depth > 0) search += ch;
                                if (ch === '}' && depth > 0) { depth--; if (depth === 0) { const value = JSON.parse(search); await callback(value); search = ''; objectStart = -1; } }
                            }
                            return { done: false, rest: '' };
                        };
                    };
                    const feed = async (text) => {
                        let rest = text;
                        while (rest.length) {
                            if (phase === 'find-artists' || phase === 'find-presets') {
                                search += rest;
                                const marker = markerFor(phase === 'find-artists' ? 'artists' : 'presets');
                                const at = search.indexOf(marker);
                                if (at < 0) { search = search.slice(-marker.length); return; }
                                rest = search.slice(at + marker.length); search = '';
                                parser = createParser(phase === 'find-artists' ? importArtist : importPreset);
                                phase = phase === 'find-artists' ? 'artists' : 'presets';
                            } else {
                                const result = await parser(rest);
                                if (!result.done) return;
                                rest = result.rest;
                                search = '';
                                phase = phase === 'artists' ? 'find-presets' : 'done';
                                if (phase === 'done') return;
                            }
                        }
                    };
                    showToast('正在流式导入大备份...');
                    while (true) {
                        const chunk = await reader.read();
                        if (chunk.done) break;
                        const text = decoder.decode(chunk.value, { stream: true });
                        if (!headerApplied) {
                            const themeMatch = text.match(/"theme":"(light|dark)"/);
                            if (themeMatch) actions.setTheme(themeMatch[1]);
                            const categoryMatch = text.match(/"categories":(\[[\s\S]*?\]),"artists":\[/);
                            if (categoryMatch) {
                                try {
                                    const importedCategories = JSON.parse(categoryMatch[1]);
                                    importedCategories.forEach(category => {
                                        if (typeof category === 'string' && category && !state.categories.includes(category)) state.categories.push(category);
                                    });
                                } catch (_) {}
                            }
                            headerApplied = true;
                        }
                        await feed(text);
                    }
                    await feed(decoder.decode());
                    const mergedDuplicates = await applyArtistDeduplication();
                    actions.saveMeta();
                    actions.saveCats();
                    actions.savePresets();
                    state.pageImages = {};
                    renderAll();
                    showToast(`导入完成! 新增 ${addedCount}，更新 ${updatedCount}，图片 ${importedImages} 张${mergedDuplicates ? `，合并重复 ${mergedDuplicates} 条` : ''}`);
                };
                if (file.size > 64 * 1024 * 1024 && file.stream && typeof TextDecoder !== 'undefined') {
                    try { await importLargeBackup(file); } catch (error) { console.error(error); showToast(`导入失败：${error.message || error}`); }
                    return;
                }
                const extractArrayObjects = (source, key) => {
                    const marker = `"${key}"`;
                    const markerIndex = source.indexOf(marker);
                    if (markerIndex < 0) return [];
                    const arrayStart = source.indexOf('[', markerIndex + marker.length);
                    if (arrayStart < 0) return [];
                    const result = [];
                    let objectStart = -1;
                    let depth = 0;
                    let inString = false;
                    let escaped = false;
                    for (let i = arrayStart + 1; i < source.length; i++) {
                        const ch = source[i];
                        if (inString) {
                            if (escaped) escaped = false;
                            else if (ch === '\\') escaped = true;
                            else if (ch === '"') inString = false;
                            continue;
                        }
                        if (ch === '"') { inString = true; continue; }
                        if (ch === '{') {
                            if (depth === 0) objectStart = i;
                            depth++;
                        } else if (ch === '}' && depth > 0) {
                            depth--;
                            if (depth === 0 && objectStart >= 0) {
                                try { result.push(JSON.parse(source.slice(objectStart, i + 1))); } catch (_) {}
                                objectStart = -1;
                            }
                        } else if (ch === ']' && depth === 0) break;
                    }
                    return result;
                };
                const reader = new FileReader();
                reader.onload = async(e) => {
                    try {
                        let recovered = false;
                        let json;
                        try {
                            json = JSON.parse(e.target.result);
                        } catch (parseError) {
                            const recoveredArtists = extractArrayObjects(e.target.result, 'artists');
                            const recoveredPresets = extractArrayObjects(e.target.result, 'presets');
                            if (!recoveredArtists.length && !recoveredPresets.length) throw parseError;
                            json = { artists: recoveredArtists, presets: recoveredPresets };
                            recovered = true;
                            console.warn('Backup JSON was truncated; recovered complete records.', parseError);
                        }
                        const list = Array.isArray(json) ? json : (json && Array.isArray(json.artists) ? json.artists : []);
                        const presets = json && Array.isArray(json.presets) ? json.presets : [];
                        if (Array.isArray(json.categories)) {
                            json.categories.forEach(category => {
                                if (typeof category === 'string' && category && !state.categories.includes(category)) state.categories.push(category);
                            });
                        }
                        if (json.theme === 'light' || json.theme === 'dark') actions.setTheme(json.theme);
                        showToast(`分析 ${list.length} 条数据...`);

                        const existingPresetNames = new Set(state.presets.map(p => p.name));
                        const usedIds = new Set([...state.artists, ...state.presets].map(item => String(item.id)));
                        const importedArtistIds = new Map();
                        const allocateImportedId = (sourceId) => {
                            const candidate = String(sourceId || '');
                            if (/^[A-Za-z0-9._-]{1,160}$/.test(candidate) && !usedIds.has(candidate)) {
                                usedIds.add(candidate);
                                return candidate;
                            }
                            let generated;
                            do { generated = String(Date.now() + Math.random()); } while (usedIds.has(generated));
                            usedIds.add(generated);
                            return generated;
                        };
                        let addedCount = 0;
                        let updatedCount = 0;

                        for(const item of list) {
                            let tag = String(item.tag || item.prompt || '');
                            let name = String(item.name || '');
                            if(!tag && name) tag = name;
                            if(!name && tag) name = tag;
                            if(!tag) continue;

                            let cats = Array.isArray(item.categories) ? item.categories : [];
                            if(item.category && item.category !== '未分类') cats.push(item.category);
                            if(cats.length === 0) cats = ['未分类'];
                            cats = [...new Set(cats)];
                            cats.forEach(c => { if(c !== '未分类' && !state.categories.includes(c)) state.categories.push(c); });

                            const img = typeof item.imageUrl === 'string' ? item.imageUrl : (typeof item.image === 'string' ? item.image : '');

                            let existing = findEquivalentArtist(state.artists, { tag, name });
                            if(existing) {
                                if (item.id !== undefined && item.id !== null) importedArtistIds.set(String(item.id), String(existing.id));
                                // 存在则更新合并属性
                                if(img && img.startsWith('data:')) {
                                    state.pageImages[existing.id] = await db.put(existing.id, img);
                                }
                                if(item.danbooruCount !== undefined) existing.danbooruCount = parseInt(item.danbooruCount) || 0;
                                if(Array.isArray(item.socialLinks)) existing.socialLinks = item.socialLinks;
                                existing.categories = [...new Set([...existing.categories, ...cats])];
                                updatedCount++;
                            } else {
                                // 不存在则新增
                                let id = allocateImportedId(item.id);
                                if (item.id !== undefined && item.id !== null) importedArtistIds.set(String(item.id), id);
                                if(img && img.startsWith('data:')) state.pageImages[id] = await db.put(id, img);
                                const artist = {
                                    id, name: name||'Unknown', tag,
                                    categories: cats,
                                    danbooruCount: parseInt(item.danbooruCount)||0,
                                    socialLinks: Array.isArray(item.socialLinks) ? item.socialLinks : [],
                                    createdAt: item.createdAt||Date.now()
                                };
                                state.artists.push(artist);
                                addedCount++;
                            }
                        }

                        if(presets.length > 0) {
                            for(const p of presets) {
                                if (!p || typeof p !== 'object') continue;
                                if(!existingPresetNames.has(p.name)) {
                                    const pid = allocateImportedId(p.id);
                                    const presetImage = typeof p.imageUrl === 'string' ? p.imageUrl : (typeof p.image === 'string' ? p.image : '');
                                    if (presetImage.startsWith('data:')) {
                                        state.pageImages[pid] = await db.put(pid, presetImage);
                                    }
                                    const { imageUrl, image, ...presetMeta } = p;
                                    const remappedItems = Array.isArray(p.items) ? p.items.map(presetItem => ({
                                        ...presetItem,
                                        id: importedArtistIds.get(String(presetItem.id)) || String(presetItem.id)
                                    })) : [];
                                    state.presets.push({ ...presetMeta, id: pid, items: remappedItems });
                                    existingPresetNames.add(p.name);
                                }
                            }
                            actions.savePresets();
                        }

                        const mergedDuplicates = await applyArtistDeduplication();
                        actions.saveMeta();
                        actions.saveCats();
                        state.pageImages = {};
                        renderAll();
                        showToast(recovered
                            ? `备份尾部不完整，已恢复 ${addedCount} 条画师、${updatedCount} 条更新${mergedDuplicates ? `，合并重复 ${mergedDuplicates} 条` : ''}`
                            : `导入完成! 新增 ${addedCount}，更新 ${updatedCount}${mergedDuplicates ? `，合并重复 ${mergedDuplicates} 条` : ''}`);
                    } catch(err) {
                        console.error(err);
                        const reason = err instanceof Error && err.message ? err.message : String(err || '未知错误');
                        showToast(`导入失败：${reason.slice(0, 36)}`);
                    }
                };
                reader.readAsText(file);
            };

export { importData };
