/* Move existing control nodes at the established sidebar breakpoint.
   Their original listeners and all account/session behavior remain intact. */
(() => {
  'use strict';
  const media=window.matchMedia('(max-width:780px)');
  const controls=document.getElementById('topbarSecondary');
  const actions=document.querySelector('.topbar-actions');
  const slot=document.getElementById('mobileTopbarControls');
  const sidebar=document.getElementById('sidebar');
  const menu=document.getElementById('menuBtn');
  const close=document.getElementById('sidebarClose');
  const account=document.getElementById('accountBtn');
  const accountMenu=document.getElementById('accountMenu');
  function placeControls(){
    actions.prepend(controls);
    if(media.matches){accountMenu.hidden=true;account.setAttribute('aria-expanded','false');}
    else sidebar.classList.remove('open');
  }
  placeControls();
  media.addEventListener('change',placeControls);
  new MutationObserver(()=>{
    const open=sidebar.classList.contains('open');
    menu.setAttribute('aria-expanded',String(open));
    if(open&&media.matches){
      const rail=window.matchMedia('(max-width:600px)').matches;
      (rail?sidebar.querySelector('.nav-item:not([hidden])'):close)?.focus({preventScroll:true});
    }
  }).observe(sidebar,{attributes:true,attributeFilter:['class']});
  new MutationObserver(()=>account.setAttribute('aria-expanded',String(!accountMenu.hidden)))
    .observe(accountMenu,{attributes:true,attributeFilter:['hidden']});
  close.addEventListener('click',()=>menu.focus({preventScroll:true}));
  document.addEventListener('keydown',event=>{
    if(event.key!=='Escape'||event.isComposing)return;
    if(!accountMenu.hidden){accountMenu.hidden=true;account.focus();}
    else if(media.matches&&sidebar.classList.contains('open')){
      sidebar.classList.remove('open');
      (window.matchMedia('(max-width:600px)').matches?document.getElementById('navRailToggle'):menu)?.focus();
    }
    else return;
    event.preventDefault();event.stopImmediatePropagation();
  },true);
  document.addEventListener('click',event=>{
    if(media.matches)return;
    if(!accountMenu.hidden&&!accountMenu.contains(event.target)&&!account.contains(event.target))accountMenu.hidden=true;
  });
})();
