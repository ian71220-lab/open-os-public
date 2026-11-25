/* OPEN OS v1.0.4.41: press feedback for home overview cards. A soft wave expands from the pointer.
   Delegated on document, so cards rendered later need no binding. Mouse and touch only; keyboard activation has no wave. */
(() => {
  'use strict';
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  document.addEventListener('pointerdown', event => {
    if (reduceMotion?.matches || event.button > 0) return;
    const card = event.target.closest?.('.overview-card');
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const x = event.clientX - rect.left, y = event.clientY - rect.top;
    // Wave must cover the farthest corner from the press point.
    const size = 2 * Math.hypot(Math.max(x, rect.width - x), Math.max(y, rect.height - y));
    const wave = document.createElement('span');
    wave.className = 'ripple-wave';
    wave.setAttribute('aria-hidden', 'true');
    wave.style.width = `${size}px`;
    wave.style.height = `${size}px`;
    wave.style.left = `${x}px`;
    wave.style.top = `${y}px`;
    card.append(wave);
    wave.addEventListener('animationend', () => wave.remove(), {once: true});
    setTimeout(() => wave.remove(), 900);
  }, {passive: true});
})();
