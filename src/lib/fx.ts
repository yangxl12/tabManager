/** 粉碎粒子特效层（照搬 demo 算法，独立于 React 渲染） */
import { shade } from './colors';

let layer: HTMLElement | null = null;

export function initFxLayer(el: HTMLElement | null): void {
  layer = el;
}

function mount(node: HTMLElement): void {
  if (!layer) return;
  layer.appendChild(node);
}

export function shatter(rect: DOMRect | { left: number; top: number; width: number; height: number }, color: string, count = 12): void {
  if (!layer) return;
  const ring = document.createElement('div');
  ring.className = 'fx-ring';
  ring.style.cssText = `left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px;border-color:${color}`;
  mount(ring);
  requestAnimationFrame(() => {
    ring.style.transform = 'scale(1.12)';
    ring.style.opacity = '0';
  });
  setTimeout(() => ring.remove(), 480);

  for (let i = 0; i < count; i++) {
    const s = document.createElement('i');
    s.className = 'fx-shard';
    const size = 3 + Math.random() * 8;
    const bg = i % 4 === 0 ? color : i % 4 === 1 ? shade(color, 16) : i % 4 === 2 ? shade(color, -14) : '#D5CFC4';
    s.style.cssText =
      `left:${rect.left + Math.random() * rect.width}px;top:${rect.top + Math.random() * rect.height}px;` +
      `width:${size}px;height:${size}px;background:${bg};border-radius:${Math.random() < 0.45 ? '50%' : '2px'}`;
    mount(s);
    const ang = Math.random() * Math.PI * 2;
    const dist = 32 + Math.random() * 98;
    const dx = Math.cos(ang) * dist;
    const dy = Math.sin(ang) * dist - 16;
    requestAnimationFrame(() => {
      s.style.transform = `translate3d(${dx}px,${dy}px,0) rotate(${Math.random() * 720 - 360}deg) scale(${0.3 + Math.random() * 0.6})`;
      s.style.opacity = '0';
    });
    setTimeout(() => s.remove(), 820);
  }
}

/**
 * 批量粉碎：对每张卡片播粒子 + 标记关闭动画。
 * @returns 需要等待的毫秒数（动画播完再调 chrome API）
 */
export function crushCards(elements: HTMLElement[], colorOf: (el: HTMLElement) => string): number {
  let maxDelay = 0;
  elements.forEach((el, i) => {
    if (i > 16) return; // 批量时限制粒子总量
    const r = el.getBoundingClientRect();
    shatter(r, colorOf(el), 12 - Math.min(6, Math.floor(elements.length / 3)));
    el.style.animationDelay = `${i * 30}ms`;
    maxDelay = Math.max(maxDelay, i * 30);
  });
  return elements.length ? maxDelay + 300 : 0;
}
