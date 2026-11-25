(() => {
  'use strict';
  // Preserve viewport position only when the caller is updating the same screen.
  // Never use this across route changes, login/logout, or explicit navigation.
  let sequence = 0;
  const snapshot = () => ({
    x: window.scrollX || 0,
    y: window.scrollY || 0,
    // Some screens have independently scrolling panels (e.g. the Gmail reader).
    panels: [...(document.getElementById('app')?.querySelectorAll('[data-preserve-scroll]') || [])]
      .map((element, index) => ({index, top:element.scrollTop, left:element.scrollLeft}))
  });
  const restore = (position, root = document.getElementById('app')) => {
    if (!position || !root) return;
    const token = ++sequence;
    const apply = () => {
      if (token !== sequence || !root.isConnected) return;
      window.scrollTo({left:position.x, top:position.y, behavior:'instant'});
      const panels = root.querySelectorAll('[data-preserve-scroll]');
      position.panels.forEach(({index, top, left}) => {
        if (panels[index]) {panels[index].scrollTop = top; panels[index].scrollLeft = left;}
      });
    };
    apply();
    // Modal dismissal, focus restoration and layout can occur after the render.
    requestAnimationFrame(apply);
  };
  const keep = (render, enabled = true) => {
    if (!enabled) {++sequence; return render();}
    const position = snapshot();
    try {return render();}
    finally {restore(position);}
  };
  window.IAN_OS_SCROLL = {snapshot, restore, keep};
})();
