(() => {
  'use strict';
  let activeOverlay = null;

  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function webUrl(value) {
    try {
      const url = new URL(String(value || '').trim());
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return '';
      return url.href;
    } catch { return ''; }
  }

  function defaults(zh) {
    return [
      {id: 'cpbl', name: zh ? '範例頁面 A' : 'Example A', url: 'https://example.com/'},
      {id: 'mlb', name: zh ? '範例頁面 B' : 'Example B', url: 'https://example.org/'}
    ];
  }

  function cardsFor(source, zh) {
    return Array.isArray(source) ? source : defaults(zh);
  }

  function cardMarkup(item, zh) {
    const href = webUrl(item.url);
    if (!href) return '';
    return `<a class="quick-card quick-score-card" href="${esc(href)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(item.name)}"><b><span class="quick-score-icon" aria-hidden="true">⚾</span>${esc(item.name)}</b><span>${zh ? '開啟比數頁面' : 'Open scores page'} ↗</span></a>`;
  }

  function render(source, zh) {
    return cardsFor(source, zh).map(item => cardMarkup(item, zh)).join('');
  }

  function footer(zh) {
    return `<div class="score-cards-foot"><button type="button" class="text-btn" data-edit-score-cards>${zh ? '編輯比數卡' : 'Edit score cards'}</button></div>`;
  }

  function rowMarkup(item, index, total, zh) {
    const label = item.name || (index + 1);
    return `<div class="score-editor-row" data-score-row="${index}">
      <label>${zh ? '名稱' : 'Name'}<input data-score-field="name" data-score-index="${index}" required maxlength="40" value="${esc(item.name)}"></label>
      <label>URL<input data-score-field="url" data-score-index="${index}" type="url" required maxlength="2048" inputmode="url" value="${esc(item.url)}" placeholder="https://"></label>
      <div class="score-editor-actions">
        <button type="button" class="icon-btn" data-score-move="-1" data-score-index="${index}" aria-label="${zh ? '上移' : 'Move up'} ${esc(label)}" ${index === 0 ? 'disabled' : ''}>↑</button>
        <button type="button" class="icon-btn" data-score-move="1" data-score-index="${index}" aria-label="${zh ? '下移' : 'Move down'} ${esc(label)}" ${index === total - 1 ? 'disabled' : ''}>↓</button>
        <button type="button" class="icon-btn" data-score-remove="${index}" aria-label="${zh ? '移除' : 'Remove'} ${esc(label)}">×</button>
      </div>
    </div>`;
  }

  function edit({get, save, lang, toast}) {
    if (activeOverlay) return;
    const zh = lang() === 'zh';
    const draft = cardsFor(get(), zh).map(item => ({id: item.id || crypto.randomUUID(), name: item.name || '', url: item.url || ''}));
    let dirty = false;
    const overlay = document.createElement('div');
    overlay.className = 'modal-backdrop score-cards-overlay';
    overlay.innerHTML = `<section class="modal" role="dialog" aria-modal="true" aria-label="${zh ? '編輯比數卡' : 'Edit score cards'}">
      <div class="modal-header"><div><div class="eyebrow">SCORE CARDS</div><h2>${zh ? '編輯比數卡' : 'Edit score cards'}</h2></div><button type="button" class="icon-btn" data-score-close aria-label="${zh ? '關閉' : 'Close'}">×</button></div>
      <p class="score-cards-hint">${zh ? '比數卡會顯示在首頁「快速新增」。網址需為 https:// 或 http://。' : 'Score cards appear in Quick Add on Home. URLs must start with https:// or http://.'}</p>
      <form><div class="score-editor-list"></div>
        <div class="score-editor-footer">
          <button type="button" class="secondary-btn" data-score-add>＋ ${zh ? '新增比數卡' : 'Add score card'}</button>
          <div class="modal-actions"><button type="button" class="secondary-btn" data-score-close>${zh ? '取消' : 'Cancel'}</button><button type="submit" class="primary-btn">${zh ? '儲存' : 'Save'}</button></div>
        </div>
      </form>
    </section>`;
    document.body.append(overlay);
    activeOverlay = overlay;
    window.IAN_OS_DIALOG?.activate(overlay);
    const list = overlay.querySelector('.score-editor-list');

    const dismiss = (force = false) => {
      if (!force && dirty && !confirm(zh ? '有尚未儲存的修改。確定放棄並關閉？' : 'Discard your unsaved changes?')) return;
      overlay.remove();
      activeOverlay = null;
    };

    function redraw(focusSelector = '') {
      list.innerHTML = draft.length
        ? draft.map((item, i) => rowMarkup(item, i, draft.length, zh)).join('')
        : `<p class="score-cards-empty">${zh ? '目前沒有比數卡。按「新增比數卡」加入。' : 'No score cards. Choose "Add score card" to add one.'}</p>`;
      if (focusSelector) list.querySelector(focusSelector)?.focus({preventScroll: true});
    }

    list.addEventListener('input', event => {
      const field = event.target.dataset.scoreField;
      const index = Number(event.target.dataset.scoreIndex);
      if (!field || !draft[index]) return;
      draft[index][field] = event.target.value;
      dirty = true;
    });

    list.addEventListener('click', async event => {
      const button = event.target.closest('button');
      if (!button || !list.contains(button)) return;
      if (button.hasAttribute('data-score-move')) {
        const index = Number(button.dataset.scoreIndex);
        const next = index + Number(button.dataset.scoreMove);
        if (!draft[index] || next < 0 || next >= draft.length) return;
        [draft[index], draft[next]] = [draft[next], draft[index]];
        dirty = true;
        redraw(`[data-score-index="${next}"][data-score-field="name"]`);
      } else if (button.hasAttribute('data-score-remove')) {
        const index = Number(button.dataset.scoreRemove);
        if (!draft[index]) return;
        const removed = await window.IAN_OS_DELETE.run({name: draft[index].name || (zh ? '比數卡' : 'Score card'), action: async () => {}});
        if (!removed) return;
        draft.splice(index, 1);
        dirty = true;
        redraw();
        overlay.querySelector('[data-score-add]').focus({preventScroll: true});
      }
    });

    overlay.querySelector('[data-score-add]').addEventListener('click', () => {
      draft.push({id: crypto.randomUUID(), name: '', url: ''});
      dirty = true;
      redraw(`[data-score-index="${draft.length - 1}"][data-score-field="name"]`);
    });
    overlay.querySelectorAll('[data-score-close]').forEach(button => button.addEventListener('click', () => dismiss()));
    overlay.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !event.isComposing) { event.stopPropagation(); dismiss(); }
    });
    overlay.querySelector('form').addEventListener('submit', async event => {
      event.preventDefault();
      if (draft.some(item => !item.name.trim() || !webUrl(item.url))) {
        toast(zh ? '請確認每張比數卡都有名稱與有效的 https 網址。' : 'Each score card needs a name and a valid https URL.');
        return;
      }
      const submit = event.submitter;
      submit.disabled = true;
      try {
        await save(draft.map(item => ({id: item.id, name: item.name.trim().slice(0, 40), url: webUrl(item.url)})));
        dismiss(true);
        toast(zh ? '比數卡已儲存' : 'Score cards saved');
      } catch {
        submit.disabled = false;
        toast(zh ? '無法儲存比數卡，請重試。' : 'Could not save score cards. Try again.');
      }
    });
    redraw();
  }

  function bind(root, options) {
    root.querySelector('[data-edit-score-cards]')?.addEventListener('click', () => edit(options));
  }

  window.IAN_OS_SCORE_CARDS = {render, footer, bind};
})();
