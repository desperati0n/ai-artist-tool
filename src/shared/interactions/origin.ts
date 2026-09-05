export function originPoint(width: number, height: number, x: number, y: number) {
  x = Math.max(0, Math.min(width, x));
  y = Math.max(0, Math.min(height, y));
  const radius = Math.max(Math.hypot(x,y), Math.hypot(width-x,y), Math.hypot(x,height-y), Math.hypot(width-x,height-y));
  return { x, y, size: Math.ceil(radius * 2) };
}
export function showOriginFill(button: HTMLButtonElement, point?: { clientX: number; clientY: number }) {
  if (button.disabled) return;
  const bounds = button.getBoundingClientRect();
  const { x, y, size } = originPoint(bounds.width, bounds.height, point ? point.clientX-bounds.left : bounds.width/2, point ? point.clientY-bounds.top : bounds.height/2);
  button.style.setProperty('--origin-x', `${x.toFixed(2)}px`);
  button.style.setProperty('--origin-y', `${y.toFixed(2)}px`);
  button.style.setProperty('--origin-size', `${size}px`);
  button.classList.add('is-origin-active');
}
export function hideOriginFill(button: HTMLButtonElement) {
  button.classList.remove('is-origin-active');
  button.dataset.originPressed = 'false';
}
