

const syncSpotlightPointer = (event) => {
            if (!(event.target instanceof Element)) return;
            const card = event.target.closest('.spotlight-card');
            if (!card) return;

            const bounds = card.getBoundingClientRect();
            // Match the gradient's padding-box origin, including CSS transforms.
            const scaleX = card.offsetWidth ? bounds.width / card.offsetWidth : 1;
            const scaleY = card.offsetHeight ? bounds.height / card.offsetHeight : 1;
            const x = Math.max(0, Math.min(card.clientWidth || bounds.width, (event.clientX - bounds.left) / scaleX - card.clientLeft));
            const y = Math.max(0, Math.min(card.clientHeight || bounds.height, (event.clientY - bounds.top) / scaleY - card.clientTop));
            const hue = 202 + (event.clientX / Math.max(window.innerWidth, 1)) * 18;

            card.style.setProperty('--spot-x', `${x.toFixed(2)}px`);
            card.style.setProperty('--spot-y', `${y.toFixed(2)}px`);
            card.style.setProperty('--spot-hue', hue.toFixed(2));
        };

export { syncSpotlightPointer };
