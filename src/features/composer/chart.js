import { state } from '../../app/store.ts';
import { showArtistPreview, hideArtistPreview, movePreviewTooltip } from './preview.js';

const PIE_COLORS = ['#252522','#6b655d','#a89f93','#4d5b57','#596554','#7a6548','#3c3a37','#c1b7a7'];

let _pieSegments = [];

let _hoveredPieIdx = -1;

const drawPieChart = (canvasId, items) => {
            const canvas = document.getElementById(canvasId);
            if (!canvas || items.length === 0) return;
            const dpr = window.devicePixelRatio || 1;
            const displayW = canvas.clientWidth;
            const displayH = canvas.clientHeight;
            canvas.width = displayW * dpr;
            canvas.height = displayH * dpr;
            const ctx = canvas.getContext('2d');
            ctx.scale(dpr, dpr);
            const cx = displayW / 2, cy = displayH / 2;
            const outerR = Math.min(cx, cy) - 12;
            const innerR = outerR * 0.52;
            const totalWeight = items.reduce((s, a) => s + (state.selected[String(a.id)] || 1), 0);
            let startAngle = -Math.PI / 2;
            _pieSegments = [];
            items.forEach((a, i) => {
                const weight = state.selected[String(a.id)] || 1;
                const slice = (weight / totalWeight) * Math.PI * 2;
                const endAngle = startAngle + slice;
                const hovered = _hoveredPieIdx === i;
                const r = hovered ? outerR + 5 : outerR;
                const ir = hovered ? innerR - 2 : innerR;
                ctx.beginPath();
                ctx.arc(cx, cy, r, startAngle, endAngle);
                ctx.arc(cx, cy, ir, endAngle, startAngle, true);
                ctx.closePath();
                const color = PIE_COLORS[i % PIE_COLORS.length];
                ctx.fillStyle = color;
                if (hovered) { ctx.shadowColor = color; ctx.shadowBlur = 14; }
                ctx.fill();
                ctx.shadowBlur = 0;
                ctx.strokeStyle = 'rgba(255,255,255,0.6)';
                ctx.lineWidth = 2;
                ctx.stroke();
                const pct = ((weight / totalWeight) * 100);
                if (slice > 0.35) {
                    const mid = startAngle + slice / 2;
                    const lr = (r + ir) / 2;
                    ctx.fillStyle = '#fff';
                    ctx.font = "600 11px 'Segoe UI Variable', sans-serif";
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(Math.round(pct) + '%', cx + Math.cos(mid) * lr, cy + Math.sin(mid) * lr);
                }
                _pieSegments.push({ startAngle, endAngle, artist: a, index: i, color, pct: pct.toFixed(1) });
                startAngle = endAngle;
            });
            ctx.fillStyle = state.theme === 'dark' ? '#e2e8f0' : '#334155';
            ctx.font = "700 22px 'Segoe UI Variable', sans-serif";
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(items.length, cx, cy - 8);
            ctx.font = "11px 'Segoe UI Variable', sans-serif";
            ctx.fillStyle = '#94a3b8';
            ctx.fillText('位画师', cx, cy + 12);
        };

const setupPieHover = (canvasId, items) => {
            const canvas = document.getElementById(canvasId);
            if (!canvas) return;
            const displayW = canvas.clientWidth, displayH = canvas.clientHeight;
            const cx = displayW / 2, cy = displayH / 2;
            const outerR = Math.min(cx, cy) - 12;
            const innerR = outerR * 0.52;
            const totalWeight = items.reduce((s, a) => s + (state.selected[String(a.id)] || 1), 0);
            canvas.onmousemove = (e) => {
                const rect = canvas.getBoundingClientRect();
                const mx = e.clientX - rect.left, my = e.clientY - rect.top;
                const dx = mx - cx, dy = my - cy;
                const dist = Math.sqrt(dx * dx + dy * dy);
                let found = -1;
                if (dist >= innerR - 4 && dist <= outerR + 8) {
                    let mouseAngle = Math.atan2(dy, dx) + Math.PI / 2;
                    if (mouseAngle < 0) mouseAngle += Math.PI * 2;
                    let cum = 0;
                    for (let i = 0; i < items.length; i++) {
                        const w = state.selected[String(items[i].id)] || 1;
                        const slice = (w / totalWeight) * Math.PI * 2;
                        if (mouseAngle >= cum && mouseAngle < cum + slice) { found = i; break; }
                        cum += slice;
                    }
                }
                if (found !== _hoveredPieIdx) {
                    _hoveredPieIdx = found;
                    drawPieChart(canvasId, items);
                    if (found >= 0) {
                        showArtistPreview(String(items[found].id), e);
                        highlightArtistRow(found);
                    } else { hideArtistPreview(); highlightArtistRow(-1); }
                } else if (found >= 0) { movePreviewTooltip(e); }
            };
            canvas.onmouseleave = () => {
                if (_hoveredPieIdx !== -1) { _hoveredPieIdx = -1; drawPieChart(canvasId, items); hideArtistPreview(); highlightArtistRow(-1); }
            };
        };

const highlightArtistRow = (idx) => {
            document.querySelectorAll('.artist-hover-row').forEach((el, i) => {
                if (i === idx) { el.style.borderColor = PIE_COLORS[i % PIE_COLORS.length]; el.style.background = 'var(--nt-blue-soft)'; }
                else { el.style.borderColor = 'transparent'; el.style.background = ''; }
            });
        };

export { PIE_COLORS, _pieSegments, _hoveredPieIdx, drawPieChart, setupPieHover, highlightArtistRow };
