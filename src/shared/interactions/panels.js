

const closeToolPanels = () => {
            document.getElementById('sidebar-left-container')?.classList.remove('is-open');
            document.getElementById('sidebar-right-container')?.classList.remove('is-open');
            document.getElementById('panel-scrim')?.classList.remove('is-open');
        };

const toggleToolPanel = (side) => {
            const target = document.getElementById(side === 'filters' ? 'sidebar-left-container' : 'sidebar-right-container');
            const wasOpen = target?.classList.contains('is-open');
            closeToolPanels();
            if (!target || wasOpen) return;
            target.classList.add('is-open');
            document.getElementById('panel-scrim')?.classList.add('is-open');
            requestAnimationFrame(() => target.querySelector('button, input, textarea, [role="button"]')?.focus());
        };

const syncCategoryDockPill = (animate = true) => {
            const list = document.querySelector('.category-list');
            const pill = list?.querySelector('.category-dock-pill');
            const activeItem = list?.querySelector('.category-item.is-active');
            if (!list || !pill || !activeItem) return;

            if (!animate) pill.style.transition = 'none';
            pill.style.opacity = '1';
            pill.style.height = `${activeItem.offsetHeight}px`;
            pill.style.setProperty('--dock-y', `${activeItem.offsetTop}px`);

            if (!animate) {
                requestAnimationFrame(() => requestAnimationFrame(() => {
                    pill.style.transition = '';
                }));
            }
        };

export { closeToolPanels, toggleToolPanel, syncCategoryDockPill };
