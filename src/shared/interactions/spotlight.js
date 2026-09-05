

const syncSpotlightPointer = (event) => {
            if (!(event.target instanceof Element)) return;
            const card = event.target.closest('.spotlight-card');
            if (!card) return;

            const bounds = card.getBoundingClientRect();
            const x = Math.max(0, Math.min(bounds.width, event.clientX - bounds.left));
            const y = Math.max(0, Math.min(bounds.height, event.clientY - bounds.top));
            const hue = 202 + (event.clientX / Math.max(window.innerWidth, 1)) * 18;

            card.style.setProperty('--spot-x', `${x.toFixed(2)}px`);
            card.style.setProperty('--spot-y', `${y.toFixed(2)}px`);
            card.style.setProperty('--spot-hue', hue.toFixed(2));
        };

export { syncSpotlightPointer };
