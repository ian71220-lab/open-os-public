(() => {
  'use strict';
  const ROUTE_KEY = 'open-os-public-pwa-route-v1';
  const DISMISSED_KEY = 'open-os-public-pwa-dismissed-update-v1';
  let registration = null;
  let waitingWorker = null;
  let updateAccepted = false;
  let activationRequested = false;
  let updateActivated = false;
  let activationTimer = null;
  let notice = null;
  let message = null;
  let activateButton = null;
  let laterButton = null;

  function makeNotice() {
    if (notice) return;
    notice = document.createElement('aside');
    notice.id = 'pwa-update-notice';
    notice.hidden = true;
    notice.setAttribute('role', 'status');
    notice.setAttribute('aria-live', 'polite');
    notice.innerHTML = '<strong>OPEN OS 有更新</strong><p data-pwa-message>新版本已準備好，你可以選擇現在更新或稍後更新。</p><div class="pwa-update-actions"><button type="button" class="secondary-btn" data-pwa-later>稍後</button><button type="button" class="primary-btn" data-pwa-activate>更新</button></div>';
    document.body.append(notice);
    message = notice.querySelector('[data-pwa-message]');
    activateButton = notice.querySelector('[data-pwa-activate]');
    laterButton = notice.querySelector('[data-pwa-later]');
    activateButton.addEventListener('click', acceptUpdate);
    laterButton.addEventListener('click', deferUpdate);
  }

  // A form counts as edited only when a field differs from its initial value. Search boxes
  // are not edits. The flag alone is not enough: it is set on every keystroke and never cleared.
  function fieldChanged(field) {
    if (field.type === 'search' || field.type === 'file' || field.disabled || field.readOnly) return false;
    if (field.type === 'checkbox' || field.type === 'radio') return field.checked !== field.defaultChecked;
    if (field.tagName === 'SELECT') return Array.from(field.options).some(option => option.selected !== option.defaultSelected);
    return field.value !== field.defaultValue;
  }
  function hasEditedForm() {
    for (const form of document.querySelectorAll('form[data-pwa-dirty="true"]')) {
      if (!form.isConnected || form.closest('[hidden]')) continue;
      if (!form.getClientRects().length) continue;
      if (Array.from(form.querySelectorAll('input,textarea,select')).some(fieldChanged)) return true;
    }
    return false;
  }

  function setNotice(text, show = true) {
    makeNotice();
    message.textContent = text;
    notice.hidden = !show;
  }

  function storeRouteAndScroll() {
    try {
      const nav = window.IAN_OS_PWA_NAVIGATION;
      const userId = window.IAN_OS_CLOUD?.user()?.id;
      if (!userId || !nav?.snapshot) return;
      sessionStorage.setItem(ROUTE_KEY, JSON.stringify({
        owner: userId,
        route: nav.snapshot(),
        url: `${location.pathname}${location.search}${location.hash}`,
        scrollX: window.scrollX,
        scrollY: window.scrollY,
        savedAt: Date.now()
      }));
    } catch (error) {
      console.warn('[OPEN OS PWA] Route and scroll could not be saved for update.', error);
    }
  }

  function reloadAfterAcceptedUpdate() {
    if (!updateAccepted || hasEditedForm()) {
      if (updateAccepted) setNotice('更新已準備好。請先儲存或關閉正在編輯的表單，之後會套用更新。');
      return;
    }
    storeRouteAndScroll();
    location.reload();
  }

  function requestActivationWhenSafe() {
    if (!updateAccepted || activationRequested || !waitingWorker) return;
    if (hasEditedForm()) {
      setNotice('更新已準備好。請先儲存或關閉正在編輯的表單，之後會套用更新。');
      return;
    }
    activationRequested = true;
    setNotice('更新已開始，正在安全切換版本。');
    waitingWorker.postMessage({ type: 'ACTIVATE_AFTER_CONFIRMATION' });
    // If the switch never completes, offer a manual reload instead of waiting forever.
    clearTimeout(activationTimer);
    activationTimer = setTimeout(() => {
      if (updateActivated) return;
      setNotice('更新尚未完成。請重新載入頁面套用新版。');
      activateButton.hidden = false;
      activateButton.disabled = false;
      activateButton.textContent = '重新載入';
      activateButton.onclick = () => { updateAccepted = true; reloadAfterAcceptedUpdate(); };
    }, 15000);
  }

  function acceptUpdate() {
    updateAccepted = true;
    try { localStorage.removeItem(DISMISSED_KEY); } catch {}
    requestActivationWhenSafe();
  }

  function wasRecentlyDismissed(worker) {
    try {
      const dismissed = JSON.parse(localStorage.getItem(DISMISSED_KEY) || 'null');
      return dismissed?.scriptURL === worker.scriptURL && Number.isFinite(dismissed.dismissedAt) && Date.now() - dismissed.dismissedAt < 24 * 60 * 60 * 1000;
    } catch { return false; }
  }

  function deferUpdate() {
    if (activationRequested || updateActivated) {
      updateAccepted = false;
      setNotice('新版已啟用。你可以稍後手動重新載入套用。');
      laterButton.hidden = true;
      activateButton.textContent = '重新載入';
      activateButton.onclick = () => {
        updateAccepted = true;
        reloadAfterAcceptedUpdate();
      };
      return;
    }
    updateAccepted = false;
    if (waitingWorker) {
      try { localStorage.setItem(DISMISSED_KEY, JSON.stringify({ scriptURL: waitingWorker.scriptURL, dismissedAt: Date.now() })); } catch {}
    }
    setNotice('', false);
  }

  function showAvailableUpdate(worker) {
    waitingWorker = worker;
    if (wasRecentlyDismissed(worker)) return;
    activationRequested = false;
    updateActivated = false;
    makeNotice();
    laterButton.hidden = false;
    activateButton.hidden = false;
    activateButton.disabled = false;
    activateButton.textContent = '更新';
    activateButton.onclick = acceptUpdate;
    setNotice('新版本已準備好，你可以選擇現在更新或稍後更新。');
  }

  function watchInstalling(worker) {
    worker.addEventListener('statechange', () => {
      if (worker.state === 'installed' && navigator.serviceWorker.controller) showAvailableUpdate(registration.waiting || worker);
    });
  }

  function registerWorker() {
    if (!('serviceWorker' in navigator) || location.protocol !== 'https:' && location.hostname !== 'localhost') return;
    navigator.serviceWorker.register('sw.js?v=1.0.4.45', { scope: './', updateViaCache: 'none' }).then(reg => {
      registration = reg;
      if (reg.waiting) showAvailableUpdate(reg.waiting);
      reg.addEventListener('updatefound', () => {
        if (reg.installing) watchInstalling(reg.installing);
      });
      // One foreground check per page load; no timer or background polling.
      reg.update().catch(() => {});
    }).catch(error => console.warn('[OPEN OS PWA] Service worker registration failed.', error));

    let controlled = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      const wasControlled = controlled;
      controlled = !!navigator.serviceWorker.controller;
      // The first takeover of an uncontrolled page is not an update. An update the user accepted always applies.
      if (!wasControlled && !activationRequested) return;
      clearTimeout(activationTimer);
      updateActivated = true;
      if (updateAccepted) reloadAfterAcceptedUpdate();
      else {
        waitingWorker = null;
        setNotice('新版已啟用。你可以稍後手動重新載入套用。');
        laterButton.hidden = true;
        activateButton.hidden = false;
        activateButton.textContent = '重新載入';
        activateButton.onclick = () => {
          updateAccepted = true;
          reloadAfterAcceptedUpdate();
        };
      }
    });
  }

  document.addEventListener('input', event => {
    const form = event.target.closest?.('form');
    if (form) form.dataset.pwaDirty = 'true';
  }, true);
  document.addEventListener('change', event => {
    const form = event.target.closest?.('form');
    if (form) form.dataset.pwaDirty = 'true';
  }, true);
  // Saving or resetting a form clears its edited state.
  document.addEventListener('submit', event => {
    if (event.target instanceof HTMLFormElement) delete event.target.dataset.pwaDirty;
  }, true);
  document.addEventListener('reset', event => {
    if (event.target instanceof HTMLFormElement) delete event.target.dataset.pwaDirty;
  }, true);

  const editObserver = new MutationObserver(() => {
    if (updateActivated && updateAccepted && !hasEditedForm()) reloadAfterAcceptedUpdate();
    else if (updateAccepted && !hasEditedForm()) requestActivationWhenSafe();
  });
  editObserver.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'class', 'style'] });

  const themeMeta = document.querySelector('meta[name="theme-color"]');
  if (themeMeta) {
    const syncThemeColor = () => { themeMeta.content = document.documentElement.dataset.theme === 'dark' ? '#202124' : '#f5f5f7'; };
    syncThemeColor();
    new MutationObserver(syncThemeColor).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', registerWorker, { once: true });
  else registerWorker();
})();
