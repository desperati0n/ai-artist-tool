import type { ButtonHTMLAttributes } from 'react';
import { hideOriginFill, showOriginFill } from '../interactions/origin';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { origin?: boolean };
export function Button({ children, className = '', origin = true, ...props }: Props) {
  if (!origin) return <button type="button" {...props} className={className}>{children}</button>;
  return <button type="button" {...props} className={`origin-button ${className}`} data-origin-button="ready"
    onPointerEnter={event => { showOriginFill(event.currentTarget,event); props.onPointerEnter?.(event); }}
    onPointerLeave={event => { hideOriginFill(event.currentTarget); props.onPointerLeave?.(event); }}
    onPointerDown={event => { if(event.button===0) { showOriginFill(event.currentTarget,event); event.currentTarget.dataset.originPressed='true'; } props.onPointerDown?.(event); }}
    onPointerUp={event => { event.currentTarget.dataset.originPressed='false'; if(!event.currentTarget.matches(':hover, :focus-visible')) hideOriginFill(event.currentTarget); props.onPointerUp?.(event); }}
    onPointerCancel={event => { hideOriginFill(event.currentTarget); props.onPointerCancel?.(event); }}
    onFocus={event => { if(event.currentTarget.matches(':focus-visible')) showOriginFill(event.currentTarget); props.onFocus?.(event); }}
    onBlur={event => { hideOriginFill(event.currentTarget); props.onBlur?.(event); }}
    onKeyDown={event => { if(!event.repeat && (event.key==='Enter'||event.key===' ')) { showOriginFill(event.currentTarget); event.currentTarget.dataset.originPressed='true'; } props.onKeyDown?.(event); }}
    onKeyUp={event => { if(event.key==='Enter'||event.key===' ') { event.currentTarget.dataset.originPressed='false'; if(!event.currentTarget.matches(':hover, :focus-visible')) hideOriginFill(event.currentTarget); } props.onKeyUp?.(event); }}
  ><span className="origin-button__content">{children}</span></button>;
}
