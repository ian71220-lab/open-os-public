(() => {
  'use strict';
  const app=document.getElementById('app');
  const header=document.querySelector('.topbar');
  if(!app||!header)return;
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  const updateHeader=()=>{
    const scrolled=window.scrollY>48;
    header.classList.toggle('is-scrolled',scrolled);
    document.documentElement.classList.toggle('bento-scrolled',scrolled);
  };
  updateHeader();
  window.addEventListener('scroll',updateHeader,{passive:true});

  if(!('IntersectionObserver' in window))return;
  const seen=new WeakSet();
  const selector=[
    ':scope > .page-head :is(.eyebrow,.page-title,.page-subtitle,button)',
    ':scope > .panel',
    ':scope > .section',
    ':scope > .restaurant-grid > *',
    ':scope > .card-grid > *',
    ':scope > .project-grid > *',
    ':scope > .overview-grid > *',
    ':scope > .automation-grid > *',
    ':scope > .asset-list > *',
    ':scope > .home-layout-grid > *',
    '.section-head > h2',
    '.entry-prose > p',
    '.restaurant-notes'
  ].join(',');
  const reveal=(element,immediate=false)=>{
    if(!element.classList.contains('bento-reveal-pending'))return;
    if(immediate)element.style.setProperty('--bento-reveal-delay','0ms');
    element.classList.add('bento-reveal-visible');
    observer.unobserve(element);
    window.setTimeout(()=>{
      element.classList.remove('bento-reveal-pending','bento-reveal-visible');
      element.style.removeProperty('--bento-reveal-delay');
    },900);
  };
  const observer=new IntersectionObserver(entries=>{
    const visible=entries.filter(entry=>entry.isIntersecting).sort((a,b)=>{
      const y=a.boundingClientRect.top-b.boundingClientRect.top;
      return y||a.boundingClientRect.left-b.boundingClientRect.left;
    });
    visible.forEach((entry,index)=>{
      entry.target.style.setProperty('--bento-reveal-delay',`${Math.min(index,4)*55}ms`);
      reveal(entry.target);
    });
  },{threshold:0.04,rootMargin:'0px 0px -4% 0px'});
  const add=root=>{
    if(reduced.matches)return;
    const candidates=[];
    if(root.nodeType!==Node.ELEMENT_NODE)return;
    if(root.matches?.(selector))candidates.push(root);
    candidates.push(...root.querySelectorAll(selector));
    for(const element of candidates){
      if(seen.has(element)||element.closest('[hidden]'))continue;
      seen.add(element);
      element.classList.add('bento-reveal-pending');
      observer.observe(element);
    }
  };
  add(app);
  let scheduled=false;
  new MutationObserver(records=>{
    if(scheduled||!records.some(record=>record.addedNodes.length))return;
    scheduled=true;
    requestAnimationFrame(()=>{scheduled=false;add(app)});
  }).observe(app,{childList:true,subtree:true});
  app.addEventListener('focusin',event=>{
    const element=event.target.closest('.bento-reveal-pending');
    if(element)reveal(element,true);
  });
  reduced.addEventListener('change',()=>{
    if(!reduced.matches)return;
    app.querySelectorAll('.bento-reveal-pending').forEach(element=>reveal(element,true));
  });
})();
