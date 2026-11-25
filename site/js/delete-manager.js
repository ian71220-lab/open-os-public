(() => {
  'use strict';

  const escape = value => String(value ?? '').replace(/[&<>"']/g, character =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));

  function language() {
    return window.IAN_OS_UI?.lang?.() === 'en' ? 'en' : 'zh';
  }

  function copy(options = {}) {
    const en = language() === 'en';
    const name = String(options.name || '').trim();
    return {
      title: options.title || (name
        ? (en ? `Delete “${name}”?` : `刪除「${name}」？`)
        : (en ? 'Delete this item?' : '刪除這筆資料？')),
      message: options.message || (en ? 'This action cannot be undone.' : '此操作無法復原。'),
      cancel: en ? 'Cancel' : '取消',
      remove: en ? 'Delete' : '刪除',
      retry: en ? 'Unable to delete. Check your connection or permissions, then try again.' : '刪除失敗。請檢查連線或權限後重試。',
      working: en ? 'Deleting…' : '刪除中…'
    };
  }

  function run(options = {}) {
    if (typeof options.action !== 'function') return Promise.resolve(false);
    const labels = copy(options);
    return new Promise(resolve => {
      const origin=document.activeElement,previousOverflow=document.body.style.overflow;
      const overlay = document.createElement('div');
      overlay.className = 'modal-backdrop delete-confirm-backdrop';
      overlay.innerHTML = `<section class="modal delete-confirm" role="dialog" aria-modal="true" aria-labelledby="delete-confirm-title" aria-describedby="delete-confirm-message">
        <div class="delete-confirm-mark" aria-hidden="true">!</div>
        <div><div class="eyebrow">${language() === 'en' ? 'DESTRUCTIVE ACTION' : '刪除確認'}</div><h2 id="delete-confirm-title">${escape(labels.title)}</h2></div>
        <p id="delete-confirm-message">${escape(labels.message)}</p>
        <p class="delete-confirm-error" role="alert" hidden></p>
        <div class="modal-actions">
          <button type="button" class="secondary-btn" data-delete-cancel autofocus>${escape(labels.cancel)}</button>
          <button type="button" class="danger-btn" data-delete-confirm>${escape(labels.remove)}</button>
        </div>
      </section>`;
      document.body.appendChild(overlay);
      if(window.IAN_OS_DIALOG)window.IAN_OS_DIALOG.activate(overlay);else document.body.style.overflow='hidden';
      const cancel = overlay.querySelector('[data-delete-cancel]');
      const confirm = overlay.querySelector('[data-delete-confirm]');
      const error = overlay.querySelector('.delete-confirm-error');
      let busy = false;
      if(!window.IAN_OS_DIALOG)requestAnimationFrame(()=>cancel.focus({preventScroll:true}));
      const close = result => {
        if (busy) return;
        if(window.IAN_OS_DIALOG)window.IAN_OS_DIALOG.deactivate(overlay);else{document.body.style.overflow=previousOverflow;requestAnimationFrame(()=>origin?.isConnected&&origin.focus({preventScroll:true}));}
        overlay.remove();
        resolve(result);
      };
      cancel.addEventListener('click', () => close(false));
      overlay.addEventListener('click', event => { if (event.target === overlay) close(false); });
      overlay.addEventListener('keydown', event => {
        if (event.key === 'Escape' && !event.isComposing) { event.preventDefault();event.stopPropagation();close(false); }
        if(event.key==='Tab'&&!window.IAN_OS_DIALOG){const items=[...overlay.querySelectorAll('button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled])')].filter(node=>node.offsetParent!==null);if(!items.length)return;const first=items[0],last=items.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}
      });
      confirm.addEventListener('click', async () => {
        if (busy) return;
        busy = true;cancel.disabled = true;confirm.disabled = true;confirm.textContent = labels.working;
        error.hidden = true;error.textContent = '';
        try {
          await options.action();
          busy = false;
          close(true);
        } catch (reason) {
          busy = false;cancel.disabled = false;confirm.disabled = false;confirm.textContent = labels.remove;
          error.textContent = options.errorMessage || labels.retry;error.hidden = false;
          confirm.focus({preventScroll:true});
          options.onError?.(reason);
        }
      });
    });
  }

  window.IAN_OS_DELETE = {run};
})();
