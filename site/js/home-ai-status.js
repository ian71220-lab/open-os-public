(() => {
  // Read-only home card: summarises the daily automation rules and their latest runs.
  // It only reads existing preference data. It has no controls that run, approve or change anything.
  const MAX_ROWS = 6;
  const MAX_RESULT = 80;

  function clip(text, max) {
    const s = String(text || '').replace(/\s+/g, ' ').trim();
    return s.length > max ? `${s.slice(0, max - 1)}…` : s;
  }

  function stamp(iso, lang) {
    const d = new Date(iso);
    if (!Number.isFinite(+d)) return '';
    return d.toLocaleString(lang === 'en' ? 'en-US' : 'zh-TW', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  function render({ rules = [], ui = s => s, lang = 'zh', escapeHtml }) {
    const esc = value => escapeHtml(String(value ?? ''));
    const list = Array.isArray(rules) ? rules : [];
    const enabled = list.filter(rule => rule.enabled);
    const rows = enabled.slice(0, MAX_ROWS).map(rule => {
      const last = rule.last;
      const lastText = last?.date ? `${ui('上次')} ${stamp(last.date, lang)}` : ui('尚未執行');
      const result = last?.result ? clip(last.result, MAX_RESULT) : '';
      const timeText = rule.time ? `${rule.time} ${ui('執行')} · ` : '';
      return `<li class="ai-status-row">
        <span class="ai-status-icon" aria-hidden="true">${esc(rule.icon || '◷')}</span>
        <div class="ai-status-copy"><b>${esc(ui(rule.title || ''))}</b><span>${esc(timeText + lastText)}</span>${result ? `<small>${esc(result)}</small>` : ''}</div>
        <span class="ai-status-pill">${ui('已啟用')}</span>
      </li>`;
    }).join('');
    const more = enabled.length > MAX_ROWS ? `<p class="ai-status-more">${esc(ui('還有'))} ${enabled.length - MAX_ROWS} ${esc(ui('項'))}</p>` : '';
    const body = enabled.length
      ? `<ul class="ai-status-list">${rows}</ul>${more}`
      : `<p class="ai-status-empty">${esc(ui('尚未啟用任何自動化。'))}</p>`;
    return `<section class="panel home-ai-status" aria-labelledby="homeAiStatusTitle">
      <div class="overview-heading"><div><div class="eyebrow">AI WORKFLOW</div><h2 id="homeAiStatusTitle">${esc(ui('AI 工作狀態'))}</h2></div><span class="ai-status-badge">${esc(ui('唯讀'))}</span></div>
      <p class="ai-status-summary">${esc(ui('已啟用'))} ${enabled.length} / ${list.length} ${esc(ui('項自動化'))}</p>
      ${body}
      <div class="ai-status-footer"><button type="button" class="secondary-btn compact" data-home-ai-open>${esc(ui('前往 AI 與自動化'))} →</button></div>
    </section>`;
  }

  window.IAN_OS_HOME_AI_STATUS = { render };
})();
