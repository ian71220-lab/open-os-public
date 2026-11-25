(() => {
  'use strict';

  const defaults = window.IAN_OS_HOME_LINKS || [];
  const originalById = new Map(defaults.map(link => [link.id, link]));
  let activeOverlay = null;

  const escape = value => String(value ?? '').replace(/[&<>"']/g, character =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[character]));

  function webUrl(value, icon = false) {
    try {
      const url = new URL(String(value || '').trim());
      if (url.username || url.password || !(icon ? url.protocol === 'https:' : ['https:', 'http:'].includes(url.protocol))) return '';
      return url.href;
    } catch { return ''; }
  }

  function links(source) {
    const list = Array.isArray(source) ? source : defaults;
    return list.filter(item => item && typeof item === 'object').map((item, index) => ({
      id: String(item.id || `custom-${index}`).slice(0, 80),
      name: String(item.name || '').slice(0, 80),
      url: String(item.url || '').slice(0, 2048),
      iconUrl: String(item.iconUrl || '').slice(0, 2048)
    }));
  }

  function iconMarkup(link) {
    const bundled = originalById.get(link.id);
    const src = webUrl(link.iconUrl, true) || bundled?.icon || '';
    const initial = Array.from(link.name.trim() || '?')[0].toLocaleUpperCase();
    return `${src ? `<img hidden src="${escape(src)}" data-bundled-icon="${escape(bundled?.icon || '')}" data-favicon="${escape(bundled?.favicon || '')}" alt="" aria-hidden="true" referrerpolicy="no-referrer">` : ''}<span class="home-quick-link-fallback" aria-hidden="true">${escape(initial)}</span>`;
  }

  function bindImageFallback(root) {
    root.querySelectorAll('.home-quick-link img,.home-link-editor-preview img').forEach(img => {
      const fallback = img.nextElementSibling;
      const showImage = () => { img.hidden = false;if (fallback) fallback.hidden = true; };
      const showFallback = () => {
        for (const next of [img.dataset.bundledIcon, img.dataset.favicon]) {
          if (next && next !== img.getAttribute('src') && !img.dataset.tried?.split('|').includes(next)) {
            img.dataset.tried = `${img.dataset.tried || ''}|${next}`;img.src = next;return;
          }
        }
        img.hidden = true;if (fallback) fallback.hidden = false;
      };
      img.addEventListener('load', showImage);
      img.addEventListener('error', showFallback);
      if (img.complete) img.naturalWidth ? showImage() : showFallback();
    });
  }

  function render(source, language = 'zh') {
    const items = links(source).filter(link => link.name.trim() && webUrl(link.url));
    const zh = language === 'zh';
    return `<section class="home-quick-links" aria-label="${zh ? '常用網站' : 'Quick Links'}">
      <div class="home-quick-links-head">
        <div><div class="eyebrow">QUICK LINKS</div><h2>${zh ? '常用網站' : 'Quick Links'}</h2></div>
        <button class="text-btn home-quick-links-edit" type="button" data-edit-home-links>${zh ? '編輯' : 'Edit'}</button>
      </div>
      <div class="home-quick-links-list">${items.length ? items.map(link =>
        `<a class="home-quick-link" href="${escape(webUrl(link.url))}" target="_blank" rel="noopener noreferrer" title="${escape(link.name)}" aria-label="${escape(link.name)}（${zh ? '在新分頁開啟' : 'opens in a new tab'}）">${iconMarkup(link)}<span class="home-quick-link-label">${escape(link.name)}</span></a>`
      ).join('') : `<span class="home-quick-links-empty">${zh ? '尚無常用網站，點選編輯新增。' : 'No Quick Links yet. Choose Edit to add one.'}</span>`}</div>
    </section>`;
  }

  function editorRow(link, index, total, zh) {
    return `<div class="home-link-editor-row" data-home-link-row="${index}">
      <span class="home-link-editor-preview">${iconMarkup(link)}</span>
      <div class="home-link-editor-fields">
        <label>${zh ? '名稱' : 'Name'}<input data-link-field="name" data-link-index="${index}" required maxlength="80" value="${escape(link.name)}"></label>
        <label>URL<input data-link-field="url" data-link-index="${index}" type="url" required maxlength="2048" inputmode="url" value="${escape(link.url)}" placeholder="https://example.com/"></label>
        <label class="home-link-icon-field">${zh ? '自訂圖示 URL（選填，HTTPS）' : 'Custom icon URL (optional, HTTPS)'}<input data-link-field="iconUrl" data-link-index="${index}" type="url" maxlength="2048" inputmode="url" value="${escape(link.iconUrl)}" placeholder="https://example.com/icon.png"></label>
      </div>
      <div class="home-link-editor-actions">
        <button type="button" class="icon-btn" data-link-move="-1" data-link-index="${index}" aria-label="${zh ? '上移' : 'Move up'} ${escape(link.name || index + 1)}" title="${zh ? '上移' : 'Move up'}" ${index === 0 ? 'disabled' : ''}>↑</button>
        <button type="button" class="icon-btn" data-link-move="1" data-link-index="${index}" aria-label="${zh ? '下移' : 'Move down'} ${escape(link.name || index + 1)}" title="${zh ? '下移' : 'Move down'}" ${index === total - 1 ? 'disabled' : ''}>↓</button>
        <button type="button" class="icon-btn" data-link-remove="${index}" aria-label="${zh ? '移除' : 'Remove'} ${escape(link.name || index + 1)}" title="${zh ? '移除' : 'Remove'}">×</button>
        <button type="button" class="secondary-btn compact home-link-icon-reset" data-link-reset="${index}" ${link.iconUrl ? '' : 'disabled'}>${zh ? '重設圖示' : 'Reset icon'}</button>
      </div>
    </div>`;
  }

  function edit({get, save, lang, toast}) {
    if (activeOverlay) return;
    const zh = lang() === 'zh';
    const draft = links(get());
    let dirty = false;
    const overlay = document.createElement('div');
    overlay.className = 'modal-backdrop home-links-overlay';
    overlay.innerHTML = `<section class="modal" role="dialog" aria-modal="true" aria-label="${zh ? '編輯常用網站' : 'Edit Quick Links'}">
      <div class="modal-header"><div><div class="eyebrow">QUICK LINKS</div><h2>${zh ? '編輯常用網站' : 'Edit Quick Links'}</h2></div><button type="button" class="icon-btn" data-links-close aria-label="${zh ? '關閉' : 'Close'}">×</button></div>
      <form><div class="home-links-editor-list"></div><div class="home-links-editor-footer">
        <button type="button" class="secondary-btn" data-links-add>＋ ${zh ? '新增網站' : 'Add website'}</button>
        <div class="modal-actions"><button type="button" class="secondary-btn" data-links-close>${zh ? '取消' : 'Cancel'}</button><button type="submit" class="primary-btn">${zh ? '儲存' : 'Save'}</button></div>
      </div></form>
    </section>`;
    document.body.append(overlay);
    activeOverlay = overlay;
    window.IAN_OS_DIALOG?.activate(overlay);
    const list = overlay.querySelector('.home-links-editor-list');
    const dismiss = (force = false) => {
      if (!force && dirty && !confirm(zh ? '有尚未儲存的修改。確定放棄並關閉？' : 'Discard your unsaved Quick Links changes?')) return;
      overlay.remove();activeOverlay = null;
    };

    function redraw(focusSelector = '') {
      const scrollTop = list.scrollTop;
      list.innerHTML = draft.map((item, i) => editorRow(item, i, draft.length, zh)).join('');
      list.scrollTop = scrollTop;
      bindImageFallback(list);
      if (focusSelector) list.querySelector(focusSelector)?.focus({preventScroll:true});
    }

    list.addEventListener('input', event => {
      const field = event.target.dataset.linkField;
      const index = Number(event.target.dataset.linkIndex);
      if (!field || !draft[index]) return;
      draft[index][field] = event.target.value;
      dirty = true;
    });
    list.addEventListener('click', async event => {
      const button = event.target.closest('button');
      if (!button || !list.contains(button)) return;
      const index = Number(button.dataset.linkIndex ?? button.dataset.linkRemove ?? button.dataset.linkReset);
      if (!draft[index]) return;
      if (button.hasAttribute('data-link-move')) {
        const next = index + Number(button.dataset.linkMove);
        if (next < 0 || next >= draft.length) return;
        [draft[index], draft[next]] = [draft[next], draft[index]];
        dirty = true;redraw(`[data-link-index="${next}"][data-link-field="name"]`);
      } else if (button.hasAttribute('data-link-remove')) {
        const removed = await window.IAN_OS_DELETE.run({name:draft[index].name || (zh ? '常用網站' : 'Quick Link'),action:async()=>{}});
        if (!removed) return;
        draft.splice(index, 1);dirty = true;redraw();
        overlay.querySelector('[data-links-add]').focus({preventScroll:true});
      } else if (button.hasAttribute('data-link-reset')) {
        draft[index].iconUrl = '';dirty = true;redraw(`[data-link-index="${index}"][data-link-field="iconUrl"]`);
      }
    });
    overlay.querySelector('[data-links-add]').addEventListener('click', () => {
      draft.push({id:crypto.randomUUID(),name:'',url:'',iconUrl:''});
      dirty = true;redraw(`[data-link-index="${draft.length - 1}"][data-link-field="name"]`);
      list.scrollTop = list.scrollHeight;
    });
    overlay.querySelectorAll('[data-links-close]').forEach(button => button.addEventListener('click', () => dismiss()));
    overlay.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !event.isComposing) { event.stopPropagation();dismiss(); }
    });
    overlay.querySelector('form').addEventListener('submit', async event => {
      event.preventDefault();
      if (draft.some(item => !item.name.trim() || !webUrl(item.url) || (item.iconUrl.trim() && !webUrl(item.iconUrl, true)))) {
        toast(zh ? '請確認名稱、網址及 HTTPS 圖示網址。' : 'Check the name, URL, and HTTPS icon URL.');
        return;
      }
      const submit=event.submitter;submit.disabled=true;
      try{
        await save(draft.map(item => ({id:item.id,name:item.name.trim(),url:webUrl(item.url),iconUrl:item.iconUrl.trim() ? webUrl(item.iconUrl, true) : ''})));
        dismiss(true);toast(zh ? '常用網站已儲存' : 'Quick Links saved');
      }catch{submit.disabled=false;toast(zh ? '無法儲存常用網站，請重試。' : 'Could not save Quick Links. Try again.');}
    });
    redraw();
  }

  function bind(root, options) {
    bindImageFallback(root.querySelector('.home-quick-links'));
    root.querySelector('[data-edit-home-links]')?.addEventListener('click', () => edit(options));
  }

  window.IAN_OS_HOME_QUICK_LINKS = {render, bind, closeEditor:() => {if(activeOverlay){activeOverlay.remove();activeOverlay=null;}}};
})();
