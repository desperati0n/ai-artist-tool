import {describe, expect, it} from 'vitest';
import {syncSpotlightPointer} from './spotlight';

describe('spotlight pointer geometry', () => {
  function cardAtScale(scale = 1) {
    const card = document.createElement('div');
    card.className = 'spotlight-card';
    const image = document.createElement('img');
    card.append(image);
    Object.defineProperties(card, {
      offsetWidth: {value: 200}, offsetHeight: {value: 300},
      clientWidth: {value: 198}, clientHeight: {value: 298},
      clientLeft: {value: 1}, clientTop: {value: 1},
    });
    card.getBoundingClientRect = () => ({left: 10, top: 20, width: 200 * scale, height: 300 * scale} as DOMRect);
    return {card, image};
  }

  it('uses the inner border as the gradient origin on nested artwork', () => {
    const {card, image} = cardAtScale();
    syncSpotlightPointer({target: image, clientX: 41, clientY: 66});
    expect(card.style.getPropertyValue('--spot-x')).toBe('30.00px');
    expect(card.style.getPropertyValue('--spot-y')).toBe('45.00px');
  });

  it('tracks the same point while the card scales on press', () => {
    const {card, image} = cardAtScale(0.99);
    syncSpotlightPointer({target: image, clientX: 10 + 31 * 0.99, clientY: 20 + 46 * 0.99});
    expect(card.style.getPropertyValue('--spot-x')).toBe('30.00px');
    expect(card.style.getPropertyValue('--spot-y')).toBe('45.00px');
  });

  it('clamps all four edges to the visible padding box', () => {
    const {card, image} = cardAtScale();
    syncSpotlightPointer({target: image, clientX: -5, clientY: -5});
    expect(card.style.getPropertyValue('--spot-x')).toBe('0.00px');
    expect(card.style.getPropertyValue('--spot-y')).toBe('0.00px');
    syncSpotlightPointer({target: image, clientX: 500, clientY: 500});
    expect(card.style.getPropertyValue('--spot-x')).toBe('198.00px');
    expect(card.style.getPropertyValue('--spot-y')).toBe('298.00px');
  });
});
