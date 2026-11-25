/* OPEN OS icon set (v1.0.4.37): one stroke style for every UI icon. Add names here, never inline glyphs. */
(function(){
  const P = {
 "home": "M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
 "notes": "M4 4h16v16H4z M7 8h10 M7 12h10 M7 16h6",
 "prompts": "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z",
 "skills": "M9 3v18 M3 9h18 M3 15h18",
 "videos": "M4 5h16v14H4z M10 9.5l5 2.5-5 2.5z",
 "bookmarks": "M5 4h14v16l-7-3-7 3z",
 "communications": "M4 5h16v11H8l-4 3z",
 "projects": "M3 6h6l2 2h10v11H3z",
 "home-assets": "M4 10l8-6 8 6v9H4z M9 19v-6h6v6",
 "credit-cards": "M3 6h18v12H3z M3 10h18 M6 15h4",
 "travel": "M10.5 3.5h3l-1 6.5 6 3.5v2l-6-1.5-.5 4 2 1.5v1.5L12 20.5l-3 1v-1.5l2-1.5-.5-4-6 1.5v-2l6-3.5z",
 "vendors": "M4 9l1.5-5h13L20 9 M4 9h16v11H4z M9 20v-6h6v6",
 "restaurants": "M7 3v7a2 2 0 0 0 2 2v9 M5 3v5 M9 3v5 M16 21V3c-2 1-3 3-3 6s1 4 3 4",
 "routines": "M4 4h16v16H4z M8 12l3 3 5-6",
 "tasks": "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M8 12l3 3 5-6",
 "calendar": "M4 5h16v16H4z M8 2v6 M16 2v6 M4 10h16",
 "automations": "M13 2L4 14h7l-1 8 9-12h-7z",
 "health": "M3 12h4l3-8 4 16 3-8h4",
 "graph": "M12 4a2 2 0 1 0 0 4 2 2 0 0 0 0-4z M5 16a2 2 0 1 0 0 4 2 2 0 0 0 0-4z M19 16a2 2 0 1 0 0 4 2 2 0 0 0 0-4z M12 8v4 M12 12l-5 4 M12 12l5 4",
 "settings": "M4 6h10 M18 6h2 M4 12h4 M12 12h8 M4 18h12 M20 18h0 M14 4v4 M8 10v4 M16 16v4",
 "export": "M12 3v12 M7 10l5 5 5-5 M4 20h16",
 "reset": "M4 12a8 8 0 1 0 2.4-5.7 M4 4v5h5",
 "contrast": "M12 3a9 9 0 1 0 0 18z M12 3v18",
 "chevron": "M9 6l6 6-6 6",
 "star": "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z",
 "check": "M4 4h16v16H4z M8 12l3 3 5-6",
 "cart": "M3 4h2l2.4 10.2a1 1 0 0 0 1 .8h8.9a1 1 0 0 0 1-.8L20 8H6 M9 20h.01 M17 20h.01",
 "more": "M5 12h.01 M12 12h.01 M19 12h.01",
 "grid": "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
 "video": "m8 5 11 7-11 7z",
 "bookmark": "M5 3h14v18l-7-4-7 4z",
 "note": "M5 3h14v18H5z M8 8h8 M8 12h8 M8 16h5",
 "prompt": "m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z",
 "task": "M4 5h16v15H4z m4 7 3 3 5-6",
 "message": "M3 5h18v13H7l-4 3z M7 9h10 M7 13h7",
 "sun": "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M12 2v3 M12 19v3 M2 12h3 M19 12h3 M5 5l2 2 M17 17l2 2 M5 19l2-2 M17 7l2-2",
 "alert": "m12 3 10 18H2z M12 9v5 M12 17h.01",
 "clock": "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18 M12 7v5l3 2",
 "tag": "M3 3h8l10 10-8 8L3 11z M7 7h.01"
};
  window.IAN_OS_ICON = function(name){
    const d = P[name] || P.grid;
    return `<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="${d}"/></svg>`;
  };
})();
