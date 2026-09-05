const showToast = (msg) => {
            const div = document.createElement('div');
            div.className = 'bg-slate-800 text-white px-5 py-3 rounded-full shadow-xl text-sm font-bold flex items-center gap-2 animate-fade-in z-[200]';
            const icon = document.createElement('span');
            icon.className = 'w-5 h-5 text-green-400 text-center font-black';
            icon.setAttribute('aria-hidden', 'true');
            icon.textContent = '✓';
            div.append(icon, document.createTextNode(String(msg)));
            document.getElementById('toast-container')?.appendChild(div);
            setTimeout(() => div.remove(), 2000);
        };

const formatArchiveSize = (bytes) => {
            const value = Number(bytes) || 0;
            if (value < 1024) return `${value} B`;
            const units = ['KB', 'MB', 'GB', 'TB'];
            let size = value / 1024;
            let unit = units[0];
            for (let index = 1; index < units.length && size >= 1024; index++) {
                size /= 1024;
                unit = units[index];
            }
            return `${size >= 100 ? size.toFixed(0) : size.toFixed(1)} ${unit}`;
        };

const showArchiveProgress = (title, detail, percent = null) => {
            let root = document.getElementById('archive-progress-overlay');
            if (!root) {
                root = document.createElement('div');
                root.id = 'archive-progress-overlay';
                root.className = 'fixed inset-0 z-[260] flex items-center justify-center p-4 bg-black/55 backdrop-blur-sm';
                root.setAttribute('role', 'dialog');
                root.setAttribute('aria-modal', 'true');
                root.innerHTML = `<div class="w-full max-w-md rounded-2xl bg-white dark:bg-[#202020] p-6 text-slate-800 dark:text-[#f1f1ef] shadow-2xl"><div data-archive-title class="text-base font-bold"></div><div data-archive-detail class="mt-2 min-h-10 text-sm leading-6 text-slate-500 dark:text-[#b4b4b0]"></div><div class="mt-5 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-[#373737]"><div data-archive-bar class="h-full rounded-full bg-[#20201e] dark:bg-[#e8e3d9] transition-[width] duration-200"></div></div><div data-archive-percent class="mt-2 text-right text-xs font-mono text-slate-400"></div></div>`;
                document.body.appendChild(root);
            }
            root.querySelector('[data-archive-title]').textContent = title;
            root.querySelector('[data-archive-detail]').textContent = detail;
            const bar = root.querySelector('[data-archive-bar]');
            const percentLabel = root.querySelector('[data-archive-percent]');
            if (Number.isFinite(percent)) {
                const safePercent = Math.max(0, Math.min(100, Number(percent)));
                bar.style.width = `${safePercent}%`;
                bar.classList.remove('animate-pulse');
                percentLabel.textContent = `${Math.round(safePercent)}%`;
            } else {
                bar.style.width = '100%';
                bar.classList.add('animate-pulse');
                percentLabel.textContent = '处理中';
            }
        };

const hideArchiveProgress = () => document.getElementById('archive-progress-overlay')?.remove();

export { showToast, formatArchiveSize, showArchiveProgress, hideArchiveProgress };
