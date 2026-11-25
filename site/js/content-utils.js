/* Pure presentation/date helpers moved verbatim from app.js. */
(() => {
  'use strict';
  function dateKey(d){const p=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`;}
  function localDatePart(s){if(!s)return '';if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;const d=new Date(s);return Number.isNaN(d.getTime())?'':dateKey(d);}
  function monthStart(d){return new Date(d.getFullYear(),d.getMonth(),1);}
  function escapeHtml(s=''){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
  function renderInlineSafe(value=''){const editor=window.IAN_OS_EDITOR;return typeof editor?.renderInline==='function'?editor.renderInline(value):escapeHtml(String(value).replace(/\r?\n+/g,' '));}
  function escapeAttr(s=''){return escapeHtml(s).replace(/'/g,'&#039;');}
  window.IAN_OS_CONTENT_UTILS=Object.freeze({dateKey,localDatePart,monthStart,escapeHtml,renderInlineSafe,escapeAttr});
})();
