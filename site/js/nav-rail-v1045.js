(() => {
  'use strict';
  const sidebar=document.getElementById('sidebar');
  const toggle=document.getElementById('navRailToggle');
  const backdrop=document.getElementById('navRailBackdrop');
  const nav=document.getElementById('mainNavigation');
  const mobile=window.matchMedia('(max-width:600px)');
  const bottom=window.matchMedia('(max-width:780px)');
  if(!sidebar||!toggle||!backdrop||!nav)return;

  const keys={mobile:'open-os-public-nav-rail-mobile',desktop:'open-os-public-nav-rail-desktop'};
  const read=(key,fallback)=>{try{return localStorage.getItem(key)||fallback;}catch{return fallback;}};
  const write=(key,value)=>{try{localStorage.setItem(key,value);}catch{/* The rail still works without storage. */}};
  let mobileCollapsed=read(keys.mobile,'collapsed')!=='expanded';
  let desktopCollapsed=read(keys.desktop,'expanded')==='collapsed';

  function labelButtons(){
    sidebar.querySelectorAll('button').forEach(button=>{
      const name=button.querySelector('b')?.textContent.trim()||button.getAttribute('aria-label')||button.title;
      if(!name)return;
      if(button!==toggle){button.setAttribute('aria-label',name);button.title=name;}
    });
  }
  function firstItem(){return nav.querySelector('.nav-item:not([hidden]):not(:disabled)');}
  function sync({focusOpen=false,focusClose=false}={}){
    if(bottom.matches){sidebar.classList.remove('open');backdrop.hidden=true;document.body.classList.remove('nav-rail-collapsed');return;}
    const isMobile=mobile.matches;
    if(!isMobile)sidebar.classList.remove('open');
    const expanded=isMobile?!mobileCollapsed:!desktopCollapsed;
    document.body.classList.toggle('nav-rail-collapsed',!expanded);
    sidebar.classList.toggle('open',isMobile&&expanded);
    backdrop.hidden=!(isMobile&&expanded);
    toggle.setAttribute('aria-expanded',String(expanded));
    const description=expanded?'收合導覽列':'展開導覽列';
    toggle.setAttribute('aria-label',description);
    toggle.title=description;
    if(focusOpen&&isMobile&&expanded)firstItem()?.focus({preventScroll:true});
    if(focusClose)toggle.focus({preventScroll:true});
  }
  function closeDrawer(focus=true){
    if(!mobile.matches||!sidebar.classList.contains('open'))return;
    mobileCollapsed=true;
    write(keys.mobile,'collapsed');
    sync({focusClose:focus});
  }
  toggle.addEventListener('click',()=>{
    if(bottom.matches)return;
    if(mobile.matches){
      if(sidebar.classList.contains('open'))closeDrawer();
      else{mobileCollapsed=false;write(keys.mobile,'expanded');sync({focusOpen:true});}
    }else{
      desktopCollapsed=!desktopCollapsed;
      write(keys.desktop,desktopCollapsed?'collapsed':'expanded');
      sync();
    }
  });
  backdrop.addEventListener('click',()=>closeDrawer());
  mobile.addEventListener('change',()=>{
    mobileCollapsed=read(keys.mobile,'collapsed')!=='expanded';
    desktopCollapsed=read(keys.desktop,'expanded')==='collapsed';
    sync();
  });
  bottom.addEventListener('change',sync);
  new MutationObserver(()=>{
    if(bottom.matches||!mobile.matches)return;
    const opened=sidebar.classList.contains('open');
    if(opened===!mobileCollapsed)return;
    mobileCollapsed=!opened;
    write(keys.mobile,opened?'expanded':'collapsed');
    sync({focusClose:!opened&&document.activeElement===document.getElementById('menuBtn')});
  }).observe(sidebar,{attributes:true,attributeFilter:['class']});
  new MutationObserver(labelButtons).observe(sidebar,{childList:true,subtree:true,characterData:true});
  labelButtons();
  sync();
})();
