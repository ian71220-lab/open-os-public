/* OPEN OS v1.0.4.43: one guided empty state for list pages, plus one delegated handler for its add button.
   The button clicks the page's own primary add control (or data-empty-target), and data-empty-view opens that view first. */
(() => {
  'use strict';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[ch]);
  const PRIMARY = '#app .page-head .primary-btn, #app .section-actions .primary-btn';
  function markup({title = '這裡目前沒有項目', hint = '新增第一筆資料，開始建立內容。', view = '', target = '', action = true} = {}) {
    const button = action
      ? `<button type="button" class="secondary-btn compact" data-empty-add${view ? ` data-empty-view="${esc(view)}"` : ''}${target ? ` data-empty-target="${esc(target)}"` : ''}>＋ 新增</button>`
      : '';
    return `<div class="empty-inline"><strong>${esc(title)}</strong><span>${esc(hint)}</span>${button}</div>`;
  }
  function filtered() {
    return '<div class="empty-state" role="status">沒有符合條件的內容。可切換「全部」或調整搜尋與分類。</div>';
  }
  document.addEventListener('click', event => {
    const button = event.target.closest?.('[data-empty-add]');
    if (!button) return;
    event.preventDefault();
    const view = button.dataset.emptyView, target = button.dataset.emptyTarget;
    const act = () => (target ? document.querySelector(target) : document.querySelector(PRIMARY))?.click();
    if (view) {
      document.querySelector(`#sidebar [data-view="${view}"]`)?.click();
      requestAnimationFrame(() => requestAnimationFrame(act));
    } else {
      act();
    }
  });
  window.IAN_OS_EMPTY_GUIDE = markup;
  window.IAN_OS_EMPTY_FILTERED = filtered;
})();
