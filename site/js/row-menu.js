/* OPEN OS v1.0.4.44: keyboard and single-open behavior for ⋯ row menus.
   Escape closes the open menu and returns focus to its ⋯ trigger; opening one menu closes the others;
   pressing anywhere outside an open menu closes it. */
(() => {
  'use strict';
  const MENUS = 'details.row-menu, details.task-row-menu';
  document.addEventListener('toggle', event => {
    const menu = event.target;
    if (!(menu instanceof HTMLDetailsElement) || !menu.matches(MENUS) || !menu.open) return;
    document.querySelectorAll(MENUS).forEach(other => { if (other !== menu && other.open) other.open = false; });
  }, true);
  document.addEventListener('pointerdown', event => {
    document.querySelectorAll(MENUS).forEach(menu => { if (menu.open && !menu.contains(event.target)) menu.open = false; });
  }, true);
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    const open = [...document.querySelectorAll(MENUS)].find(menu => menu.open);
    if (!open) return;
    const trigger = open.querySelector(':scope > summary');
    open.open = false;
    trigger?.focus();
  });
})();
