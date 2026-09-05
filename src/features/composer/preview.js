import { state } from '../../app/store.ts';
import { db } from '../../storage/images.js';

const showArtistPreview = async (id, evt) => {
            const tooltip = document.getElementById('artist-preview-tooltip');
            if (!tooltip) return;
            let img = state.pageImages[id];
            if (!img) { img = await db.get(id); if (img) state.pageImages[id] = img; }
            const artist = state.artists.find(a => String(a.id) === id);
            const name = artist ? artist.name : 'Unknown';
            const selIds = Object.keys(state.selected);
            const tw = selIds.reduce((s, sid) => s + (state.selected[sid] || 1), 0);
            const pct = tw > 0 ? ((state.selected[id] || 1) / tw * 100).toFixed(1) : '0';
            tooltip.replaceChildren();
            if (img) {
                const image = document.createElement('img');
                image.src = img;
                image.alt = '';
                tooltip.appendChild(image);
            } else {
                const placeholder = document.createElement('div');
                placeholder.style.cssText = "width:100%;aspect-ratio:3/4;display:flex;align-items:center;justify-content:center;background:#f6f5f4;color:#8b8783;font:600 11px 'Segoe UI Variable',sans-serif;letter-spacing:.08em";
                placeholder.textContent = 'NO PREVIEW';
                tooltip.appendChild(placeholder);
            }
            const label = document.createElement('div');
            label.className = 'preview-label';
            label.append(document.createTextNode(name));
            const percentage = document.createElement('span');
            percentage.className = 'preview-pct';
            percentage.textContent = `${pct}%`;
            label.appendChild(percentage);
            tooltip.appendChild(label);
            tooltip.classList.add('show');
            movePreviewTooltip(evt);
        };

const movePreviewTooltip = (e) => {
            const tooltip = document.getElementById('artist-preview-tooltip');
            if (!tooltip || !tooltip.classList.contains('show')) return;
            const sidebar = document.getElementById('sidebar-right-container');
            if (!sidebar) return;
            const sr = sidebar.getBoundingClientRect();
            const tw = tooltip.offsetWidth, th = tooltip.offsetHeight;
            let left = sr.left - tw - 12;
            let top = e.clientY - th / 2;
            if (left < 0) left = sr.right + 12;
            if (top < 8) top = 8;
            if (top + th > window.innerHeight - 8) top = window.innerHeight - th - 8;
            tooltip.style.left = left + 'px';
            tooltip.style.top = top + 'px';
        };

const hideArtistPreview = () => {
            const tooltip = document.getElementById('artist-preview-tooltip');
            if (tooltip) tooltip.classList.remove('show');
        };

export { showArtistPreview, movePreviewTooltip, hideArtistPreview };
