(() => {
'use strict';
const base=window.IAN_OS_EDITOR||{};
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const english=()=>document.documentElement.lang==='en';
const text=(zh,en)=>english()?en:zh;
const labels={
 undo:['復原','Undo'],redo:['重做','Redo'],bold:['粗體','Bold'],italic:['斜體','Italic'],strike:['刪除線','Strikethrough'],
 h2:['標題 2','Heading 2'],h3:['標題 3','Heading 3'],bullet:['項目清單','Bullet list'],number:['編號清單','Numbered list'],
 quote:['引用','Quote'],inlineCode:['行內程式碼','Inline code'],codeBlock:['程式碼區塊','Code block'],rule:['分隔線','Divider'],
 link:['連結','Link'],table:['表格','Table'],clear:['清除格式','Clear formatting'],find:['尋找','Find in editor'],
 plain:['貼上純文字','Paste as plain text'],more:['更多','More'],preview:['預覽','Preview'],hidePreview:['收起預覽','Hide preview'],
 close:['關閉','Close'],previous:['上一個','Previous'],next:['下一個','Next'],noResults:['找不到','No matches']
};
const t=key=>text(...labels[key]);
const safeUrl=url=>/^(https?:|mailto:)/i.test(String(url||'').trim())?String(url).trim():'#';
function inline(value){
 let html=escape(value),stash=[];
 html=html.replace(/`([^`]+)`/g,(_,code)=>{stash.push('<code>'+code+'</code>');return '\u0000'+(stash.length-1)+'\u0000';});
 html=html.replace(/\[([^\]]+)\]\(([^)]+)\)/g,(_,name,url)=>'<a href="'+escape(safeUrl(url))+'" target="_blank" rel="noopener noreferrer">'+name+'</a>');
 html=html.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/~~(.+?)~~/g,'<s>$1</s>').replace(/\*(?!\*)([^*]+)\*/g,'<em>$1</em>');
 return html.replace(/\u0000(\d+)\u0000/g,(_,i)=>stash[Number(i)]||'');
}
const cells=line=>{
 const source=line.trim().replace(/^\|/,'').replace(/\|$/,''),result=[];let current='';
 for(let i=0;i<source.length;i++){if(source[i]==='\\'&&source[i+1]==='|'){current+='|';i++;}else if(source[i]==='|'){result.push(current.trim());current='';}else current+=source[i];}
 result.push(current.trim());return result;
};
const isRule=line=>/^\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?$/.test(line||'');
function render(value){
 const lines=String(value??'').replace(/\r\n?/g,'\n').split('\n'),out=[];
 for(let i=0;i<lines.length;i++){
  // Preserve explicit empty source lines without accepting raw HTML.
  if(!lines[i].trim()){if(String(value??'')!=='')out.push('<p class="rich-empty-line"><br></p>');continue;}
  if(/^```/.test(lines[i])){const code=[];i++;while(i<lines.length&&!/^```/.test(lines[i])){code.push(lines[i]);i++;}out.push('<pre><code>'+escape(code.join('\n'))+'</code></pre>');continue;}
  if(i+1<lines.length&&lines[i].includes('|')&&isRule(lines[i+1])){
   const headers=cells(lines[i]);i+=2;const rows=[];
   while(i<lines.length&&lines[i].includes('|')&&lines[i].trim()){rows.push(cells(lines[i]));i++;}i--;
   out.push('<div class="rich-table-scroll" role="region" tabindex="0" aria-label="'+text('表格','Table')+'"><table><thead><tr>'+headers.map(x=>'<th scope="col">'+inline(x)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(row=>'<tr>'+headers.map((_,j)=>'<td>'+inline(row[j]||'')+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>');continue;
  }
  const raw=lines[i];
  if(/^\s*---\s*$/.test(raw)){out.push('<hr>');continue;}
  if(/^###\s+/.test(raw)){out.push('<h3>'+inline(raw.replace(/^###\s+/,''))+'</h3>');continue;}
  if(/^##\s+/.test(raw)){out.push('<h2>'+inline(raw.replace(/^##\s+/,''))+'</h2>');continue;}
  if(/^\s*[-*+•▪◦]\s+/.test(raw)){
   const items=[];while(i<lines.length&&/^\s*[-*+•▪◦]\s+/.test(lines[i])){items.push(lines[i].replace(/^\s*[-*+•▪◦]\s+/,''));i++;}i--;
   out.push('<ul>'+items.map(item=>'<li>'+inline(item)+'</li>').join('')+'</ul>');continue;
  }
  const numbered=raw.match(/^\s*(\d+)\.\s+(.*)$/);if(numbered){
   const items=[];while(i<lines.length){const match=lines[i].match(/^\s*(\d+)\.\s+(.*)$/);if(!match)break;items.push({number:Number(match[1]),value:match[2]});i++;}i--;
   const start=items[0].number,attrs=start===1?'':' start="'+start+'"';
   out.push('<ol'+attrs+'>'+items.map((item,index)=>{const expected=start+index,value=item.number===expected?'':' value="'+item.number+'"';return '<li'+value+'>'+inline(item.value)+'</li>';}).join('')+'</ol>');continue;
  }
  if(/^\s*>\s+/.test(raw)){
   const quotes=[];while(i<lines.length&&/^\s*>\s+/.test(lines[i])){quotes.push(lines[i].replace(/^\s*>\s+/,''));i++;}i--;
   out.push('<blockquote><p>'+quotes.map(inline).join('<br>')+'</p></blockquote>');continue;
  }
  const paragraph=[];
  while(i<lines.length&&lines[i].trim()){
   const line=lines[i],special=/^```|^\s*---\s*$|^###?\s+|^\s*[-*+•▪◦]\s+|^\s*\d+\.\s+|^\s*>\s+/.test(line)||(i+1<lines.length&&line.includes('|')&&isRule(lines[i+1]));
   if(special)break;paragraph.push(line);i++;
  }
  if(paragraph.length){i--;out.push('<p>'+paragraph.map(inline).join('<br>')+'</p>');continue;}
 }
 return out.join('');
}
const renderInline=value=>inline(String(value??'').replace(/\r?\n+/g,' '));
const pair={bold:'**',italic:'*',strike:'~~',inlineCode:'`'};
const prefix={h2:'## ',h3:'### ',bullet:'- ',number:'1. ',quote:'> '};
function stripFormatting(value){return value.replace(/^\s*(?:#{2,3}|[-*]|\d+\.|>)\s+/gm,'').replace(/\[([^\]]+)\]\([^)]+\)/g,'$1').replace(/(\*\*|~~|`{1,3})/g,'').replace(/^\s*---\s*$/gm,'');}
function format(value,start,end,kind,extra){
 const selected=value.slice(start,end),fallback=text('文字','text'),chosen=selected||fallback;let inserted=chosen;
 if(pair[kind])inserted=pair[kind]+chosen+pair[kind];
 else if(prefix[kind])inserted=chosen.split('\n').map((line,index)=>kind==='number'?(index+1)+'. '+line:prefix[kind]+line).join('\n');
 else if(kind==='link'){const href=extra||'https://';inserted='['+chosen+']('+href+')';}
 else if(kind==='codeBlock')inserted='```\n'+(selected||'')+'\n```';
 else if(kind==='rule')inserted=(start&&value[start-1]!=='\n'?'\n':'')+'---\n';
 else if(kind==='table')inserted='| '+text('欄 1 | 欄 2','Column 1 | Column 2')+' |\n| --- | --- |\n|  |  |';
 else if(kind==='clear')inserted=stripFormatting(chosen);
 const next=value.slice(0,start)+inserted+value.slice(end);
 return {value:next,start,end:start+inserted.length};
}
function tableAt(value,cursor){
 const lines=value.split('\n');let offset=0;
 for(let i=0;i<lines.length;i++){
  const lineEnd=offset+lines[i].length;
  if(cursor>=offset&&cursor<=lineEnd){
   for(let start=i;start>=0;start--){
    if(start+1<lines.length&&lines[start].includes('|')&&isRule(lines[start+1])){
     let stop=start+2;while(stop<lines.length&&lines[stop].includes('|')&&lines[stop].trim())stop++;
     if(i<stop){const a=lines.slice(0,start).join('\n').length+(start?1:0);return {start:a,end:a+lines.slice(start,stop).join('\n').length,headers:cells(lines[start]),rows:lines.slice(start+2,stop).map(cells)};}
    }
   }
  }
  offset=lineEnd+1;
 }
 return null;
}
const tableMarkdown=(headers,rows)=>'| '+headers.join(' | ')+' |\n| '+headers.map(()=>'---').join(' | ')+' |\n'+rows.map(row=>'| '+headers.map((_,i)=>row[i]||' ').join(' | ')+' |').join('\n');
function editTable(area,history,action){
 const found=tableAt(area.value,area.selectionStart);if(!found)return false;const headers=found.headers.slice(),rows=found.rows.map(row=>row.slice());
 if(action==='addRow')rows.push(headers.map(()=>' '));
 if(action==='removeRow'&&rows.length)rows.pop();
 if(action==='addColumn'){headers.push(text('新欄','New Column'));rows.forEach(row=>row.push(' '));}
 if(action==='removeColumn'&&headers.length>1){headers.pop();rows.forEach(row=>row.pop());}
 history.commit();replace(area,found.start,found.end,tableMarkdown(headers,rows));history.commit();return true;
}
function button(key,short,handler){const b=document.createElement('button');b.type='button';b.className='rich-tool';b.dataset.editorKey=key;b.dataset.short=short||'';b.textContent=short||t(key);b.title=t(key);b.setAttribute('aria-label',t(key));b.addEventListener('mousedown',event=>event.preventDefault());b.addEventListener('click',handler);return b;}
function replace(area,start,end,value,selectStart,selectEnd){area.setRangeText(value,start,end,'end');area.focus();area.setSelectionRange(selectStart??start,selectEnd??start+value.length);area.dispatchEvent(new Event('input',{bubbles:true}));}
function setupHistory(area){
 const state={undo:[],redo:[],last:area.value,applying:false,timer:0};
 const snapshot=()=>{if(state.applying||area.value===state.last)return;state.undo.push({value:state.last,start:area.selectionStart,end:area.selectionEnd});if(state.undo.length>100)state.undo.shift();state.last=area.value;state.redo=[];};
 area.addEventListener('input',()=>{clearTimeout(state.timer);state.timer=setTimeout(snapshot,180);});
 const move=(from,to)=>{clearTimeout(state.timer);snapshot();const item=from.pop();if(!item)return;to.push({value:area.value,start:area.selectionStart,end:area.selectionEnd});state.applying=true;area.value=item.value;area.setSelectionRange(item.start,item.end);state.last=area.value;area.dispatchEvent(new Event('input',{bubbles:true}));state.applying=false;area.focus();};
 return {undo:()=>move(state.undo,state.redo),redo:()=>move(state.redo,state.undo),commit:snapshot};
}
function apply(area,history,kind,extra){history.commit();const a=area.selectionStart,b=area.selectionEnd,r=format(area.value,a,b,kind,extra);area.value=r.value;area.focus();area.setSelectionRange(r.start,r.end);area.dispatchEvent(new Event('input',{bubbles:true}));history.commit();}
function promptLink(area,history){const url=window.prompt(text('輸入連結網址','Enter link URL'),'https://');if(url!==null)apply(area,history,'link',url);}
function setupFind(area,shell){
 const bar=document.createElement('div');bar.className='rich-findbar';bar.hidden=true;bar.innerHTML='<input type="search" autocomplete="off"><span aria-live="polite">0 / 0</span><button type="button">↑</button><button type="button">↓</button><button type="button">×</button>';
 const input=bar.querySelector('input'),status=bar.querySelector('span'),buttons=bar.querySelectorAll('button');let matches=[],index=-1;
 const refresh=()=>{const q=input.value.toLocaleLowerCase();matches=[];index=-1;if(q){let at=0,source=area.value.toLocaleLowerCase();while((at=source.indexOf(q,at))!==-1){matches.push(at);at+=Math.max(q.length,1);}}status.textContent=matches.length?'0 / '+matches.length:t('noResults');};
 const go=delta=>{if(!matches.length)return;index=(index+delta+matches.length)%matches.length;area.focus();area.setSelectionRange(matches[index],matches[index]+input.value.length);status.textContent=(index+1)+' / '+matches.length;requestAnimationFrame(()=>input.focus());};
 input.addEventListener('input',refresh);input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();go(e.shiftKey?-1:1);}if(e.key==='Escape'){e.preventDefault();bar.hidden=true;area.focus();}});
 buttons[0].onclick=()=>go(-1);buttons[1].onclick=()=>go(1);buttons[2].onclick=()=>{bar.hidden=true;area.focus();};
 shell.insertBefore(bar,area);return {open:()=>{bar.hidden=false;input.value='';refresh();input.focus();},close:()=>bar.hidden=true};
}
const slashCommands=[['h2','Heading','標題'],['bullet','Bullet List','項目清單'],['number','Numbered List','編號清單'],['quote','Quote','引用'],['table','Table','表格'],['rule','Divider','分隔線'],['codeBlock','Code Block','程式碼區塊']];
function setupSlash(area,shell,history){
 const menu=document.createElement('div');menu.className='rich-slash-menu';menu.hidden=true;menu.setAttribute('role','listbox');shell.appendChild(menu);let filtered=[],active=0,range=null;
 const draw=()=>{menu.innerHTML=filtered.map((item,i)=>'<button type="button" role="option" aria-selected="'+(i===active)+'" data-index="'+i+'"><b>'+escape(text(item[2],item[1]))+'</b><small>/'+item[0]+'</small></button>').join('');menu.querySelectorAll('button').forEach(b=>{b.onmousedown=e=>e.preventDefault();b.onclick=()=>choose(Number(b.dataset.index));});};
 const choose=i=>{const item=filtered[i];if(!item||!range)return;history.commit();const r=format(area.value,range.start,range.end,item[0]);area.value=r.value;area.focus();area.setSelectionRange(r.end,r.end);area.dispatchEvent(new Event('input',{bubbles:true}));history.commit();menu.hidden=true;};
 const update=()=>{const cursor=area.selectionStart,before=area.value.slice(0,cursor),lineStart=before.lastIndexOf('\n')+1,current=before.slice(lineStart),match=current.match(/^\s*\/([\w-]*)$/);if(!match){menu.hidden=true;return;}const q=match[1].toLowerCase();filtered=slashCommands.filter(item=>!q||item[0].toLowerCase().includes(q)||item[1].toLowerCase().includes(q));if(!filtered.length){menu.hidden=true;return;}range={start:lineStart,end:cursor};active=0;draw();menu.hidden=false;};
 area.addEventListener('input',update);area.addEventListener('click',()=>menu.hidden=true);area.addEventListener('keydown',e=>{if(menu.hidden)return;if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();active=(active+(e.key==='ArrowDown'?1:-1)+filtered.length)%filtered.length;draw();}else if(e.key==='Enter'){e.preventDefault();choose(active);}else if(e.key==='Escape'){e.preventDefault();menu.hidden=true;}});
 return {close:()=>menu.hidden=true};
}
let selectionToolbar,selectionToolbarRefresh=null,activeEditorShell=null,activeEditorDismiss=null;
function activateEditorLayer(shell,dismiss){if(activeEditorShell&&activeEditorShell!==shell)activeEditorDismiss?.();activeEditorShell=shell;activeEditorDismiss=dismiss;}
document.addEventListener('pointerdown',event=>{if(activeEditorShell&&!activeEditorShell.contains(event.target)){activeEditorDismiss?.();activeEditorShell=null;activeEditorDismiss=null;}});
window.addEventListener('scroll',()=>{if(selectionToolbar&&!selectionToolbar.hidden)selectionToolbar.hidden=true;selectionToolbarRefresh=null;},{passive:true});
window.addEventListener('resize',()=>{if(selectionToolbar&&!selectionToolbar.hidden)selectionToolbarRefresh?.();},{passive:true});
function ensureSelectionToolbar(){
 if(selectionToolbar)return selectionToolbar;const bar=document.createElement('div');bar.className='rich-selection-toolbar';bar.hidden=true;bar.setAttribute('role','toolbar');document.body.appendChild(bar);selectionToolbar=bar;return bar;
}
function selectionRect(area){
 const start=area.selectionStart,end=area.selectionEnd;if(start===end)return null;
 const source=area.getBoundingClientRect(),style=getComputedStyle(area),mirror=document.createElement('div');
 mirror.setAttribute('aria-hidden','true');mirror.style.cssText=`position:fixed;visibility:hidden;pointer-events:none;overflow:hidden;inset:auto;left:${source.left}px;top:${source.top}px;width:${source.width}px;height:${source.height}px;box-sizing:${style.boxSizing};padding:${style.padding};border:${style.border};font:${style.font};letter-spacing:${style.letterSpacing};line-height:${style.lineHeight};text-align:${style.textAlign};text-transform:${style.textTransform};text-indent:${style.textIndent};white-space:pre-wrap;overflow-wrap:${style.overflowWrap};word-break:${style.wordBreak};tab-size:${style.tabSize};`;
 const before=document.createTextNode(area.value.slice(0,start)),selected=document.createElement('span');selected.textContent=area.value.slice(start,end)||'\u200b';mirror.append(before,selected,document.createTextNode(area.value.slice(end)));document.body.appendChild(mirror);mirror.scrollTop=area.scrollTop;mirror.scrollLeft=area.scrollLeft;
 const range=document.createRange();range.selectNodeContents(selected);const rects=[...range.getClientRects()].filter(rect=>rect.width||rect.height),rect=rects.length?rects.reduce((box,item)=>({left:Math.min(box.left,item.left),right:Math.max(box.right,item.right),top:Math.min(box.top,item.top),bottom:Math.max(box.bottom,item.bottom)}),{left:rects[0].left,right:rects[0].right,top:rects[0].top,bottom:rects[0].bottom}):selected.getBoundingClientRect();mirror.remove();return rect;
}
function intersects(a,b,gap=0){return a.left<b.right+gap&&a.right>b.left-gap&&a.top<b.bottom+gap&&a.bottom>b.top-gap;}
function setupSelectionToolbar(area,history){
 const bar=ensureSelectionToolbar();
 const show=()=>{if(document.activeElement!==area||area.selectionStart===area.selectionEnd){bar.hidden=true;selectionToolbarRefresh=null;return;}bar.innerHTML='';for(const [kind,mark]of [['bold','B'],['italic','I'],['link','↗'],['quote','❝'],['clear','Tx']])bar.appendChild(button(kind,mark,()=>{kind==='link'?promptLink(area,history):apply(area,history,kind);bar.hidden=true;selectionToolbarRefresh=null;}));bar.hidden=false;selectionToolbarRefresh=show;bar.style.visibility='hidden';const selected=selectionRect(area),shell=area.closest('.rich-editor-shell'),dialog=area.closest('[role="dialog"]')||shell,parentRect=dialog.getBoundingClientRect(),toolbar=shell?.querySelector('.rich-toolbar')?.getBoundingClientRect(),width=bar.offsetWidth,height=bar.offsetHeight,gap=8,bounds={left:Math.max(8,parentRect.left+gap),right:Math.min(innerWidth-8,parentRect.right-gap),top:Math.max(8,parentRect.top+gap),bottom:Math.min(innerHeight-8,parentRect.bottom-gap)};if(!selected){bar.hidden=true;selectionToolbarRefresh=null;bar.style.visibility='';return;}let left=Math.max(bounds.left,Math.min(bounds.right-width,selected.left+(selected.right-selected.left-width)/2));const candidates=[selected.top-height-gap,selected.bottom+gap];let top=candidates.find(value=>value>=bounds.top&&value+height<=bounds.bottom&&(!toolbar||!intersects({left,right:left+width,top:value,bottom:value+height},toolbar,gap)));if(top==null){top=Math.max(bounds.top,Math.min(bounds.bottom-height,candidates[1]));if(toolbar&&intersects({left,right:left+width,top,bottom:top+height},toolbar,gap))top=Math.min(bounds.bottom-height,toolbar.bottom+gap);}bar.style.left=Math.round(left)+'px';bar.style.top=Math.round(top)+'px';bar.style.visibility='';};
 area.addEventListener('select',show);area.addEventListener('mouseup',show);area.addEventListener('keyup',e=>{if(!e.metaKey&&!e.ctrlKey)show();});area.addEventListener('blur',()=>setTimeout(()=>{if(!bar.contains(document.activeElement)){bar.hidden=true;selectionToolbarRefresh=null;}},120));
 area.addEventListener('scroll',show,{passive:true});
}
async function pastePlain(area,history,trigger){
 try{if(navigator.clipboard?.readText){const value=await navigator.clipboard.readText();if(value){history.commit();replace(area,area.selectionStart,area.selectionEnd,value);history.commit();return;}}}catch(_){/* One-shot fallback below. */}
 area.dataset.pastePlain='true';trigger.setAttribute('aria-pressed','true');trigger.title=text('下一次貼上將使用純文字','The next paste will be plain text');area.focus();
}
function attach(area){
 if(area.dataset.richReady)return;area.dataset.richReady='true';area.classList.add('rich-editor-area');
 const shell=document.createElement('div');shell.className='rich-editor-shell';area.parentNode.insertBefore(shell,area);shell.appendChild(area);
 const history=setupHistory(area),bar=document.createElement('div');bar.className='rich-toolbar';bar.setAttribute('role','toolbar');bar.setAttribute('aria-label',text('文字格式','Text formatting'));
 const act=kind=>()=>kind==='link'?promptLink(area,history):apply(area,history,kind);
 bar.append(button('undo','↶',history.undo),button('redo','↷',history.redo),button('bold','B',act('bold')),button('italic','I',act('italic')),button('bullet','•',act('bullet')),button('number','1.',act('number')),button('link','↗',act('link')),button('table','▦',act('table')));
 const findButton=button('find','⌕',null),moreButton=button('more','⋯',null),previewButton=button('preview','◫',null);bar.append(findButton,moreButton,previewButton);shell.insertBefore(bar,area);
 const more=document.createElement('div');more.className='rich-more-menu';more.hidden=true;more.setAttribute('role','menu');
 for(const [kind,mark]of [['strike','S̶'],['h2','H2'],['h3','H3'],['quote','❝'],['inlineCode','</>'],['codeBlock','{ }'],['rule','―'],['clear','Tx']])more.appendChild(button(kind,mark,()=>{act(kind)();more.hidden=true;}));
 for(const [action,mark,zh,en]of [['addRow','+R','新增表格列','Add table row'],['removeRow','−R','移除表格列','Remove table row'],['addColumn','+C','新增表格欄','Add table column'],['removeColumn','−C','移除表格欄','Remove table column']]){const item=button('table',mark,()=>{editTable(area,history,action);more.hidden=true;});delete item.dataset.editorKey;item.dataset.editorZh=zh;item.dataset.editorEn=en;item.title=text(zh,en);item.setAttribute('aria-label',text(zh,en));more.appendChild(item);}
 const plainButton=button('plain','⌘V',()=>pastePlain(area,history,plainButton));more.appendChild(plainButton);shell.appendChild(more);
 const finder=setupFind(area,shell),dismiss=()=>{more.hidden=true;finder.close();moreButton.setAttribute('aria-expanded','false');};findButton.onclick=()=>{more.hidden=true;moreButton.setAttribute('aria-expanded','false');activateEditorLayer(shell,dismiss);finder.open();};moreButton.onclick=()=>{finder.close();activateEditorLayer(shell,dismiss);more.hidden=!more.hidden;moreButton.setAttribute('aria-expanded',String(!more.hidden));};
 const preview=document.createElement('div');preview.className='rich-preview content-body rendered-content';preview.hidden=true;shell.appendChild(preview);previewButton.onclick=()=>{preview.hidden=!preview.hidden;const label=preview.hidden?t('preview'):t('hidePreview');previewButton.title=label;previewButton.setAttribute('aria-label',label);if(!preview.hidden)preview.innerHTML=render(area.value);};
 setupSlash(area,shell,history);setupSelectionToolbar(area,history);
 area.addEventListener('paste',event=>{if(area.dataset.pastePlain==='true'){event.preventDefault();const value=event.clipboardData?.getData('text/plain')||'';delete area.dataset.pastePlain;plainButton.setAttribute('aria-pressed','false');replace(area,area.selectionStart,area.selectionEnd,value);return;}const clip=event.clipboardData,html=clip?.getData('text/html')||'',plain=clip?.getData('text/plain')||'';let rows=[];if(/<table[\s>]/i.test(html)){const doc=new DOMParser().parseFromString(html,'text/html'),table=doc.querySelector('table');if(table)rows=Array.from(table.rows,row=>Array.from(row.cells,cell=>cell.textContent.trim().replace(/\s+/g,' ')));}if(!rows.length&&plain.includes('\t')&&plain.includes('\n'))rows=plain.trimEnd().split(/\r?\n/).map(line=>line.split('\t'));if(rows.length&&rows[0].length>1){event.preventDefault();const width=Math.max(...rows.map(row=>row.length)),safe=row=>Array.from({length:width},(_,i)=>String(row[i]||' ').replace(/\|/g,'\\|').replace(/\r?\n/g,' ')),md='| '+safe(rows[0]).join(' | ')+' |\n| '+Array(width).fill('---').join(' | ')+' |\n'+rows.slice(1).map(row=>'| '+safe(row).join(' | ')+' |').join('\n');replace(area,area.selectionStart,area.selectionEnd,md);}});
 area.addEventListener('input',()=>{if(!preview.hidden)preview.innerHTML=render(area.value);});
 area.addEventListener('keydown',e=>{const mod=e.metaKey||e.ctrlKey;if(!mod)return;const key=e.key.toLowerCase();if(key==='b'){e.preventDefault();apply(area,history,'bold');}else if(key==='i'){e.preventDefault();apply(area,history,'italic');}else if(key==='k'){e.preventDefault();promptLink(area,history);}else if(key==='z'){e.preventDefault();e.shiftKey?history.redo():history.undo();}else if(key==='f'){e.preventDefault();finder.open();}});
}
function init(){const scan=()=>document.querySelectorAll('.modal textarea:not([data-rich-ready])').forEach(attach);scan();new MutationObserver(scan).observe(document.body,{childList:true,subtree:true});}
function localize(){document.querySelectorAll('[data-editor-key]').forEach(el=>{const key=el.dataset.editorKey;if(!labels[key])return;el.title=t(key);el.setAttribute('aria-label',t(key));if(!el.dataset.short)el.textContent=t(key);});document.querySelectorAll('[data-editor-zh]').forEach(el=>{const value=text(el.dataset.editorZh,el.dataset.editorEn);el.title=value;el.setAttribute('aria-label',value);});document.querySelectorAll('.rich-toolbar').forEach(el=>el.setAttribute('aria-label',text('文字格式','Text formatting')));}
window.IAN_OS_EDITOR={...base,render,renderInline,format,init,localize};
})();
